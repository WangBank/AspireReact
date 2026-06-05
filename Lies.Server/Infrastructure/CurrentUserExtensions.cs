using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Infrastructure;

public static class CurrentUserExtensions
{
    public static int? GetCurrentUserId(this ControllerBase controller)
    {
        var userIdStr = controller.HttpContext.Items["UserId"]?.ToString();
        return int.TryParse(userIdStr, out var userId) ? userId : null;
    }

    public static string? GetCurrentUsername(this ControllerBase controller)
    {
        return controller.HttpContext.Items["Username"]?.ToString();
    }

    public static string GetCurrentUserRole(this ControllerBase controller)
    {
        return controller.HttpContext.Items["UserRole"]?.ToString() ?? "User";
    }

    public static bool IsCurrentUserAdmin(this ControllerBase controller)
    {
        var role = controller.GetCurrentUserRole();
        return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
    }

    public static IActionResult? RequireCurrentUser(this ControllerBase controller, out int userId)
    {
        userId = 0;
        var currentUserId = controller.GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return controller.Unauthorized(new { success = false, message = "未登录或Token无效" });
        }

        userId = currentUserId.Value;
        return null;
    }
}
