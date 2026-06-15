using Lies.Server.DTOs;
using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[RequireAdminUser]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly ISystemSettingService _systemSettingService;

    public AdminController(IAdminService adminService, ISystemSettingService systemSettingService)
    {
        _adminService = adminService;
        _systemSettingService = systemSettingService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var guard = EnsureAdmin();
        if (guard != null)
        {
            return guard;
        }

        var data = await _adminService.GetSummaryAsync(cancellationToken);
        return Ok(new { success = true, data, message = "管理员概览加载成功" });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(CancellationToken cancellationToken)
    {
        var guard = EnsureAdmin();
        if (guard != null)
        {
            return guard;
        }

        var data = await _adminService.GetUsersAsync(cancellationToken);
        return Ok(new { success = true, data, message = $"共 {data.Count} 个系统用户" });
    }

    [HttpPut("users/{id:int}/status")]
    public async Task<IActionResult> UpdateUserStatus(
        int id,
        [FromBody] AdminUserStatusUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = this.GetCurrentUserId();
        var guard = EnsureAdmin(adminUserId);
        if (guard != null)
        {
            return guard;
        }

        try
        {
            var result = await _adminService.UpdateUserStatusAsync(id, request.IsActive, adminUserId!.Value, cancellationToken);
            if (result == null)
            {
                return NotFound(new { success = false, message = "用户不存在" });
            }

            return Ok(new { success = true, data = result, message = "用户状态已更新" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPut("users/{id:int}/role")]
    public async Task<IActionResult> UpdateUserRole(
        int id,
        [FromBody] AdminUserRoleUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = this.GetCurrentUserId();
        var guard = EnsureAdmin(adminUserId);
        if (guard != null)
        {
            return guard;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        try
        {
            var result = await _adminService.UpdateUserRoleAsync(id, request.Role, adminUserId!.Value, cancellationToken);
            if (result == null)
            {
                return NotFound(new { success = false, message = "用户不存在" });
            }

            return Ok(new { success = true, data = result, message = "用户角色已更新" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPut("users/{id:int}/reset-password")]
    public async Task<IActionResult> ResetUserPassword(
        int id,
        [FromBody] AdminUserPasswordResetRequest request,
        CancellationToken cancellationToken)
    {
        var guard = EnsureAdmin();
        if (guard != null)
        {
            return guard;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        try
        {
            var success = await _adminService.ResetUserPasswordAsync(id, request.NewPassword, cancellationToken);
            if (!success)
            {
                return NotFound(new { success = false, message = "用户不存在" });
            }

            return Ok(new { success = true, message = "密码已重置" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPut("users/batch/status")]
    public async Task<IActionResult> BatchUpdateUserStatus(
        [FromBody] AdminUserBatchStatusUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = this.GetCurrentUserId();
        var guard = EnsureAdmin(adminUserId);
        if (guard != null)
        {
            return guard;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        try
        {
            var result = await _adminService.BatchUpdateUserStatusAsync(
                request.UserIds,
                request.IsActive,
                adminUserId!.Value,
                cancellationToken);

            return Ok(new
            {
                success = true,
                data = result,
                message = $"已批量{(request.IsActive ? "启用" : "停用")} {result.UpdatedCount} 个用户"
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPut("users/batch/role")]
    public async Task<IActionResult> BatchUpdateUserRole(
        [FromBody] AdminUserBatchRoleUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = this.GetCurrentUserId();
        var guard = EnsureAdmin(adminUserId);
        if (guard != null)
        {
            return guard;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        try
        {
            var result = await _adminService.BatchUpdateUserRoleAsync(
                request.UserIds,
                request.Role,
                adminUserId!.Value,
                cancellationToken);

            return Ok(new
            {
                success = true,
                data = result,
                message = $"已批量设置 {result.UpdatedCount} 个用户为 {request.Role}"
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpGet("reflection")]
    public async Task<IActionResult> GetReflectionContent(CancellationToken cancellationToken)
    {
        var guard = EnsureAdmin();
        if (guard != null)
        {
            return guard;
        }

        var data = await _systemSettingService.GetReflectionContentAsync(cancellationToken);
        return Ok(new { success = true, data, message = "吾日三省吾身内容加载成功" });
    }

    [HttpPut("reflection")]
    public async Task<IActionResult> UpdateReflectionContent(
        [FromBody] ReflectionContentUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = this.GetCurrentUserId();
        var guard = EnsureAdmin(adminUserId);
        if (guard != null)
        {
            return guard;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        var data = await _systemSettingService.UpdateReflectionContentAsync(
            request.Content,
            adminUserId!.Value,
            cancellationToken);

        return Ok(new { success = true, data, message = "吾日三省吾身内容已保存" });
    }

    [HttpPost("export/database")]
    public async Task<IActionResult> ExportDatabase(CancellationToken cancellationToken)
    {
        var guard = EnsureAdmin();
        if (guard != null)
        {
            return guard;
        }

        var result = await _adminService.ExportDatabaseBackupAsync(cancellationToken);
        Response.Headers.Append("X-Temp-File-Path", result.TempFilePath);
        return PhysicalFile(result.TempFilePath, result.ContentType, result.FileName);
    }

    private IActionResult? EnsureAdmin(int? userId = null)
    {
        if ((userId ?? this.GetCurrentUserId()) is null)
        {
            return Unauthorized(new { success = false, message = "未登录或Token无效" });
        }

        if (!this.IsCurrentUserAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { success = false, message = "仅管理员可以访问该功能" });
        }

        return null;
    }
}
