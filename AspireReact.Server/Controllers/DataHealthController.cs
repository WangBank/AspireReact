using AspireReact.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

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
        var report = await _dataHealthService.BuildReportAsync(cancellationToken);
        return Ok(new
        {
            success = true,
            data = report,
            message = "数据体检完成"
        });
    }
}
