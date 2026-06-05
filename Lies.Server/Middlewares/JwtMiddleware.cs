using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.IdentityModel.Tokens;

namespace Lies.Server.Middlewares;

public class JwtMiddleware
{
    private static readonly string[] AdminAllowedApiPrefixes =
    [
        "/api/admin",
        "/api/auth",
        "/api/config",
        "/api/stock/cache",
        "/api/portfolio-import/audits"
    ];

    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<JwtMiddleware> _logger;

    public JwtMiddleware(RequestDelegate next, IConfiguration configuration, ILogger<JwtMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var token = ExtractToken(context);

        if (!string.IsNullOrEmpty(token))
        {
            await AttachUserToContext(context, token);
        }

        if (ShouldBlockAdminBusinessRequest(context))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "管理员账号仅可访问管理员后台，不提供首页、录入、列表、统计与笔记等业务数据。"
            }));
            return;
        }

        await _next(context);
    }

    private static bool ShouldBlockAdminBusinessRequest(HttpContext context)
    {
        if (!string.Equals(context.Items["UserRole"]?.ToString(), "Admin", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var path = context.Request.Path.Value;
        if (string.IsNullOrWhiteSpace(path) || !path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (AdminAllowedApiPrefixes.Any(prefix =>
            path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        var endpoint = context.GetEndpoint();
        if (endpoint?.Metadata.GetMetadata<RequireAdminUserAttribute>() is not null)
        {
            return false;
        }

        return true;
    }

    private static string? ExtractToken(HttpContext context)
    {
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();

        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;

        return authHeader["Bearer ".Length..].Trim();
    }

    private async Task AttachUserToContext(HttpContext context, string token)
    {
        try
        {
            var key = AuthConfig.CreateJwtSecurityKey(_configuration);

            var tokenHandler = new JwtSecurityTokenHandler();
            var validationResult = await tokenHandler.ValidateTokenAsync(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = true,
                ValidIssuer = AuthConfig.GetJwtIssuer(_configuration),
                ValidateAudience = true,
                ValidAudience = AuthConfig.GetJwtAudience(_configuration),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            });

            if (validationResult.IsValid)
            {
                var jwtToken = (JwtSecurityToken)validationResult.SecurityToken;
                var claimsIdentity = validationResult.ClaimsIdentity ?? new ClaimsIdentity(jwtToken.Claims, "jwt");
                context.User = new ClaimsPrincipal(claimsIdentity);

                // 优先从验证后的 ClaimsIdentity 取值，兼容 ClaimTypes 与 JWT 短 claim 名之间的映射差异。
                var claims = claimsIdentity.Claims.ToList();
                var userIdClaim = claims.FirstOrDefault(c =>
                    c.Type == ClaimTypes.NameIdentifier
                    || c.Type == JwtRegisteredClaimNames.NameId
                    || c.Type == "nameid"
                    || c.Type == JwtRegisteredClaimNames.Sub
                    || c.Type == "sub");
                var usernameClaim = claims.FirstOrDefault(c =>
                    c.Type == ClaimTypes.Name
                    || c.Type == JwtRegisteredClaimNames.UniqueName
                    || c.Type == "unique_name"
                    || c.Type == "name");
                var roleClaim = claims.FirstOrDefault(c =>
                    c.Type == ClaimTypes.Role
                    || c.Type == "role");

                if (userIdClaim != null)
                    context.Items["UserId"] = userIdClaim.Value;
                if (usernameClaim != null)
                    context.Items["Username"] = usernameClaim.Value;
                if (roleClaim != null)
                {
                    context.Items["UserRole"] = roleClaim.Value;
                    context.Items["IsAdmin"] = string.Equals(roleClaim.Value, "Admin", StringComparison.OrdinalIgnoreCase);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "JWT 验证失败: {Method} {Path}, TraceId={TraceId}",
                context.Request.Method,
                $"{context.Request.PathBase}{context.Request.Path}",
                context.TraceIdentifier);
        }
    }
}

public static class JwtMiddlewareExtensions
{
    public static IApplicationBuilder UseJwtMiddleware(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<JwtMiddleware>();
    }
}
