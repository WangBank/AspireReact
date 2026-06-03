using Lies.Server.DTOs;
using Lies.Server.Entities;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockController : ControllerBase
{
    private readonly IStockSearchService _stockSearchService;
    private readonly IRedisService _redisService;
    private readonly ILogger<StockController> _logger;

    // 防刷限制：每分钟内最多 30 次搜索
    private const int RateLimitPerMinute = 30;
    private static readonly TimeSpan RateWindow = TimeSpan.FromMinutes(1);

    public StockController(
        IStockSearchService stockSearchService,
        IRedisService redisService,
        ILogger<StockController> logger)
    {
        _stockSearchService = stockSearchService;
        _redisService = redisService;
        _logger = logger;
    }

    /// <summary>
    /// 模糊搜索心魔（集成第三方API，缓存策略：Redis → PostgreSQL → 第三方API）
    /// </summary>
    /// <param name="keyword">搜索关键词（心魔代码/名称/简称）</param>
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword))
        {
            return Ok(new
            {
                success = true,
                data = new List<StockSearchResponse>(),
                message = "请输入搜索关键词"
            });
        }

        // 防刷检查
        var clientIp = GetClientIp();
        var rateLimitKey = $"rate:stock_search:{clientIp}";
        if (!await CheckRateLimitAsync(rateLimitKey))
        {
            _logger.LogWarning("心魔搜索触发频率限制: {ClientIp}, Keyword: {Keyword}", clientIp, keyword);
            return StatusCode(429, new
            {
                success = false,
                message = $"请求过于频繁，每分钟最多 {RateLimitPerMinute} 次，请稍后再试"
            });
        }

        var stocks = await _stockSearchService.SearchStocksAsync(keyword.Trim());

        var response = stocks.Select(s => new StockSearchResponse
        {
            StockCode = s.StockCode,
            StockName = s.StockName,
            StockAbbr = s.StockAbbr,
            Board = s.Board
        }).ToList();

        return Ok(new
        {
            success = true,
            data = response,
            total = response.Count,
            message = response.Count > 0
                ? $"找到 {response.Count} 只相关心魔"
                : "未找到相关心魔，请尝试其他关键词"
        });
    }

    /// <summary>
    /// 按心魔代码获取心魔详情（缓存策略：Redis → PostgreSQL → 第三方API）
    /// </summary>
    /// <param name="stockCode">心魔代码</param>
    [HttpGet("{stockCode}")]
    public async Task<IActionResult> GetByCode(string stockCode)
    {
        if (string.IsNullOrWhiteSpace(stockCode))
        {
            return BadRequest(new { success = false, message = "心魔代码不能为空" });
        }

        var stock = await _stockSearchService.GetStockByCodeAsync(stockCode.Trim());

        if (stock == null)
        {
            return NotFound(new
            {
                success = false,
                message = $"未找到心魔代码为 {stockCode} 的心魔"
            });
        }

        var response = new StockSearchResponse
        {
            StockCode = stock.StockCode,
            StockName = stock.StockName,
            StockAbbr = stock.StockAbbr,
            Board = stock.Board
        };

        return Ok(new
        {
            success = true,
            data = response,
            message = "查询成功"
        });
    }

    /// <summary>
    /// 获取心魔缓存统计信息
    /// </summary>
    [HttpGet("cache/stats")]
    public async Task<IActionResult> GetCacheStats()
    {
        var count = await _stockSearchService.GetCachedStockCountAsync();

        return Ok(new
        {
            success = true,
            data = new StockCacheStatsResponse
            {
                CachedStockCount = count,
                Message = count > 0 ? $"当前缓存 {count} 只心魔基础信息" : "缓存为空，请先刷新缓存"
            },
            message = "查询缓存统计成功"
        });
    }

    /// <summary>
    /// 刷新心魔缓存（从数据库重新加载到 Redis）
    /// </summary>
    [HttpPost("cache/refresh")]
    public async Task<IActionResult> RefreshCache()
    {
        await _stockSearchService.RefreshStockCacheAsync();
        var count = await _stockSearchService.GetCachedStockCountAsync();

        return Ok(new
        {
            success = true,
            data = new StockCacheStatsResponse
            {
                CachedStockCount = count,
                Message = $"缓存刷新成功，当前缓存 {count} 只心魔"
            },
            message = "心魔缓存刷新成功"
        });
    }

    // ─────────────────────────────────────────────────────────
    // 私有方法
    // ─────────────────────────────────────────────────────────

    /// <summary>
    /// 获取客户端 IP 地址（兼容反向代理场景）
    /// </summary>
    private string GetClientIp()
    {
        // 优先取 X-Forwarded-For（反向代理场景）
        if (Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor))
        {
            var ip = forwardedFor.FirstOrDefault()?.Split(',').FirstOrDefault()?.Trim();
            if (!string.IsNullOrEmpty(ip))
                return ip;
        }

        if (Request.Headers.TryGetValue("X-Real-IP", out var realIp))
        {
            var ip = realIp.FirstOrDefault()?.Trim();
            if (!string.IsNullOrEmpty(ip))
                return ip;
        }

        return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    /// <summary>
    /// 基于 Redis 的请求频率限制（滑动窗口计数器）
    /// 返回 true 表示允许请求，false 表示触发限流
    /// </summary>
    private async Task<bool> CheckRateLimitAsync(string key)
    {
        try
        {
            var currentValue = await _redisService.GetAsync<string>(key);

            if (string.IsNullOrEmpty(currentValue))
            {
                // 首次请求：写入计数 1，设置过期时间
                await _redisService.SetAsync(key, "1", RateWindow);
                return true;
            }

            if (int.TryParse(currentValue, out var count))
            {
                if (count >= RateLimitPerMinute)
                    return false;

                // 计数 +1，TTL 保持不变（依赖首次设置的过期时间）
                await _redisService.SetAsync(key, (count + 1).ToString(), RateWindow);
            }
            else
            {
                // 数据异常，重置计数
                await _redisService.SetAsync(key, "1", RateWindow);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "防刷检查异常，放行请求: {Key}", key);
            // 限流组件异常时放行，避免影响主流程
            return true;
        }
    }
}
