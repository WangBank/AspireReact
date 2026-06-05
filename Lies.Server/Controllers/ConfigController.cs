using System.Text.Json.Nodes;
using Lies.Server.DTOs;
using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[RequireAdminUser]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private readonly ISensitiveWordService _sensitiveWordService;

    public ConfigController(
        IConfiguration configuration,
        IWebHostEnvironment env,
        ISensitiveWordService sensitiveWordService)
    {
        _configuration = configuration;
        _env = env;
        _sensitiveWordService = sensitiveWordService;
    }

    /// <summary>
    /// 获取同花顺链接前缀配置
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        if (this.GetCurrentUserId() is null)
        {
            return Unauthorized(new { success = false, message = "未登录或Token无效" });
        }

        if (!this.IsCurrentUserAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { success = false, message = "仅管理员可以查看系统配置" });
        }

        var linkPrefix = _configuration.GetValue<string>("Tonghuashun:LinkPrefix") ?? "";
        var sensitiveWords = await _sensitiveWordService.GetConfigurationAsync();

        return Ok(new
        {
            success = true,
            data = new ConfigResponse
            {
                TonghuashunLinkPrefix = linkPrefix,
                SensitiveWordsText = sensitiveWords.SensitiveWordsText,
                SensitiveWordCount = sensitiveWords.SensitiveWordCount,
                SensitiveWordsUpdatedAt = sensitiveWords.UpdatedAt,
                SensitiveWordsUpdatedByUsername = sensitiveWords.UpdatedByUsername
            },
            message = "获取配置成功"
        });
    }

    /// <summary>
    /// 修改同花顺链接前缀配置（写入 appsettings.json）
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] ConfigUpdateRequest request)
    {
        if (this.GetCurrentUserId() is null)
        {
            return Unauthorized(new { success = false, message = "未登录或Token无效" });
        }

        if (!this.IsCurrentUserAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { success = false, message = "仅管理员可以修改系统配置" });
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                message = "参数验证失败",
                errors = ModelState
            });
        }

        try
        {
            var userId = this.GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "未登录或Token无效" });
            }

            var appSettingsPath = Path.Combine(_env.ContentRootPath, "appsettings.json");
            var json = await System.IO.File.ReadAllTextAsync(appSettingsPath);
            var root = JsonNode.Parse(json);

            if (root == null)
            {
                return StatusCode(500, new { success = false, message = "appsettings.json 解析失败" });
            }

            root["Tonghuashun"] = new JsonObject
            {
                ["LinkPrefix"] = request.TonghuashunLinkPrefix
            };

            var updatedJson = root.ToJsonString(new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true
            });

            await System.IO.File.WriteAllTextAsync(appSettingsPath, updatedJson);

            // 同步写入 Development 配置文件（若存在）
            var devSettingsPath = Path.Combine(_env.ContentRootPath, "appsettings.Development.json");
            if (System.IO.File.Exists(devSettingsPath))
            {
                await System.IO.File.WriteAllTextAsync(devSettingsPath, updatedJson);
            }

            var sensitiveWords = await _sensitiveWordService.UpdateConfigurationAsync(
                request.SensitiveWordsText,
                userId.Value);

            return Ok(new
            {
                success = true,
                data = new ConfigResponse
                {
                    TonghuashunLinkPrefix = request.TonghuashunLinkPrefix,
                    SensitiveWordsText = sensitiveWords.SensitiveWordsText,
                    SensitiveWordCount = sensitiveWords.SensitiveWordCount,
                    SensitiveWordsUpdatedAt = sensitiveWords.UpdatedAt,
                    SensitiveWordsUpdatedByUsername = sensitiveWords.UpdatedByUsername
                },
                message = "配置修改成功"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                message = $"配置修改失败: {ex.Message}"
            });
        }
    }
}
