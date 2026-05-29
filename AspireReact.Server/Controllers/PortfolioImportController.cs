using AspireReact.Server.DTOs;
using AspireReact.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

[ApiController]
[Route("api/portfolio-import")]
public class PortfolioImportController : ControllerBase
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp"
    };

    private readonly IPortfolioScreenshotImportService _portfolioScreenshotImportService;

    public PortfolioImportController(IPortfolioScreenshotImportService portfolioScreenshotImportService)
    {
        _portfolioScreenshotImportService = portfolioScreenshotImportService;
    }

    /// <summary>
    /// 识别券商截图并提取账户与持仓数据
    /// </summary>
    [HttpPost("screenshot")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> ImportScreenshot(
        [FromForm] PortfolioScreenshotImportRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                message = "参数验证失败",
                errors = ModelState
            });
        }

        if (request.Image == null)
        {
            return BadRequest(new { success = false, message = "请上传截图文件" });
        }

        if (request.Image.Length == 0)
        {
            return BadRequest(new { success = false, message = "截图文件不能为空" });
        }

        if (!string.IsNullOrWhiteSpace(request.Image.ContentType)
            && !AllowedContentTypes.Contains(request.Image.ContentType))
        {
            return BadRequest(new
            {
                success = false,
                message = "仅支持 PNG、JPG、JPEG、WebP 格式的截图"
            });
        }

        var result = await _portfolioScreenshotImportService.ParseAsync(request, cancellationToken);
        if (!result.Success)
        {
            return StatusCode(result.StatusCode, new
            {
                success = false,
                message = result.Message
            });
        }

        return Ok(new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }
}
