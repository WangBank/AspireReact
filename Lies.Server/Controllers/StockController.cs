using Lies.Server.DTOs;
using Lies.Server.Entities;
using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockController : ControllerBase
{
    private readonly IStockSearchService _stockSearchService;

    public StockController(
        IStockSearchService stockSearchService)
    {
        _stockSearchService = stockSearchService;
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
    [RequireAdminUser]
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
    [RequireAdminUser]
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
}
