using Lies.Server.Services;
using Lies.Server.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/data-health")]
public class DataHealthController : ControllerBase
{
    private readonly IDataHealthService _dataHealthService;

    public DataHealthController(IDataHealthService dataHealthService)
    {
        _dataHealthService = dataHealthService;
    }

    [HttpGet("report")]
    public async Task<IActionResult> GetReport(CancellationToken cancellationToken)
    {
        var guard = this.RequireCurrentUser(out var userId);
        if (guard != null)
        {
            return guard;
        }

        var report = await _dataHealthService.BuildReportAsync(userId, cancellationToken);
        return Ok(new
        {
            success = true,
            data = report,
            message = "数据体检完成"
        });
    }
}
