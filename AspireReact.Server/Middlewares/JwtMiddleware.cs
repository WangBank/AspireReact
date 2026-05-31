using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AspireReact.Server.Services;
using Microsoft.IdentityModel.Tokens;

namespace AspireReact.Server.Middlewares;

public class JwtMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;

    public JwtMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var token = ExtractToken(context);

        if (!string.IsNullOrEmpty(token))
        {
            await AttachUserToContext(context, token);
        }

        await _next(context);
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
            var secret = AuthConfig.GetJwtSecret(_configuration);
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

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

                if (userIdClaim != null)
                    context.Items["UserId"] = userIdClaim.Value;
                if (usernameClaim != null)
                    context.Items["Username"] = usernameClaim.Value;
            }
        }
        catch
        {
            // Token 验证失败，不附加用户信息，继续管道
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
