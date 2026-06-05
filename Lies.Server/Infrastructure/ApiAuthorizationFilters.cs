using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Lies.Server.Data;

namespace Lies.Server.Infrastructure;

public sealed class RequireAuthenticatedApiFilter(AppDbContext db) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (AllowsAnonymous(context))
        {
            return;
        }

        var httpContext = context.HttpContext;
        if (!(httpContext.Request.Path.Value?.StartsWith("/api", StringComparison.OrdinalIgnoreCase) ?? false))
        {
            return;
        }

        var userIdRaw = httpContext.Items["UserId"]?.ToString();
        if (!int.TryParse(userIdRaw, out var userId))
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                success = false,
                message = "未登录或Token无效"
            });
            return;
        }

        var user = await db.Users
            .AsNoTracking()
            .Where(item => item.Id == userId)
            .Select(item => new
            {
                item.Id,
                item.Username,
                item.Role,
                item.IsActive
            })
            .FirstOrDefaultAsync(httpContext.RequestAborted);

        if (user == null)
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                success = false,
                message = "当前用户不存在，请重新登录"
            });
            return;
        }

        if (!user.IsActive)
        {
            context.Result = new ObjectResult(new
            {
                success = false,
                message = "当前账户已被禁用"
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }

        httpContext.Items["UserId"] = user.Id.ToString();
        httpContext.Items["Username"] = user.Username;
        httpContext.Items["UserRole"] = user.Role;
        httpContext.Items["IsAdmin"] = string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase);
    }

    private static bool AllowsAnonymous(AuthorizationFilterContext context)
    {
        return context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any();
    }
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequireAdminUserAttribute : Attribute, IAsyncAuthorizationFilter
{
    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
        {
            return Task.CompletedTask;
        }

        var userIdRaw = context.HttpContext.Items["UserId"]?.ToString();
        if (!int.TryParse(userIdRaw, out _))
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                success = false,
                message = "未登录或Token无效"
            });
            return Task.CompletedTask;
        }

        var role = context.HttpContext.Items["UserRole"]?.ToString();
        if (!string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            context.Result = new ObjectResult(new
            {
                success = false,
                message = "仅管理员可以访问该功能"
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        return Task.CompletedTask;
    }
}
