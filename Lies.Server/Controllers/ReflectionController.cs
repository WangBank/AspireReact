using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/reflection")]
public class ReflectionController : ControllerBase
{
    private readonly ISystemSettingService _systemSettingService;

    public ReflectionController(ISystemSettingService systemSettingService)
    {
        _systemSettingService = systemSettingService;
    }

    [HttpGet]
    public async Task<IActionResult> GetReflectionContent(CancellationToken cancellationToken)
    {
        if (this.GetCurrentUserId() is null)
        {
            return Unauthorized(new { success = false, message = "未登录或Token无效" });
        }

        var data = await _systemSettingService.GetReflectionContentAsync(cancellationToken);
        return Ok(new { success = true, data, message = "吾日三省吾身内容加载成功" });
    }
}
