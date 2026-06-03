using System.Text.Json.Nodes;
using Lies.Server.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;

    public ConfigController(IConfiguration configuration, IWebHostEnvironment env)
    {
        _configuration = configuration;
        _env = env;
    }

    /// <summary>
    /// 获取同花顺链接前缀配置
    /// </summary>
    [HttpGet]
    public IActionResult Get()
    {
        var linkPrefix = _configuration.GetValue<string>("Tonghuashun:LinkPrefix") ?? "";

        return Ok(new
        {
            success = true,
            data = new ConfigResponse
            {
                TonghuashunLinkPrefix = linkPrefix
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

            return Ok(new
            {
                success = true,
                data = new ConfigResponse
                {
                    TonghuashunLinkPrefix = request.TonghuashunLinkPrefix
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