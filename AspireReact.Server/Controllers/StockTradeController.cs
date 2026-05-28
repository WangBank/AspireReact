using AspireReact.Server.DTOs;
using AspireReact.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockTradeController : ControllerBase
{
    private readonly IStockTradeService _tradeService;

    public StockTradeController(IStockTradeService tradeService)
    {
        _tradeService = tradeService;
    }

    /// <summary>
    /// 多条件筛选查询交易记录（分页）
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Query(
        [FromQuery] string? stockCode = null,
        [FromQuery] DateTime? tradeDate = null,
        [FromQuery] string? board = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        // 兼容 tradeDate 单日精确查询
        DateTime? tradeDateStart = null;
        DateTime? tradeDateEnd = null;
        if (tradeDate.HasValue)
        {
            tradeDateStart = tradeDate.Value.Date;
            tradeDateEnd = tradeDate.Value.Date;
        }

        var request = new TradeQueryRequest
        {
            StockCode = stockCode,
            TradeDateStart = tradeDateStart,
            TradeDateEnd = tradeDateEnd,
            Board = board,
            Page = page,
            PageSize = pageSize
        };

        var result = await _tradeService.QueryAsync(request);

        return Ok(new
        {
            success = true,
            data = result.Items,
            total = result.Total,
            page = result.Page,
            pageSize = result.PageSize,
            totalPages = result.TotalPages,
            message = $"查询到 {result.Total} 条记录"
        });
    }

    /// <summary>
    /// 获取单条交易记录详情
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _tradeService.GetByIdAsync(id);

        if (!result.Success)
        {
            return NotFound(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 统计汇总接口（按日期范围、心魔、板块统计盈亏）
    /// </summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? stockCode = null,
        [FromQuery] string? board = null)
    {
        var request = new TradeSummaryRequest
        {
            StartDate = startDate,
            EndDate = endDate,
            StockCode = stockCode,
            Board = board
        };

        var result = await _tradeService.GetSummaryAsync(request);

        return Ok(new
        {
            success = true,
            data = result,
            message = $"共统计 {result.TotalTrades} 笔交易，总盈亏 {result.TotalPnL:F2}"
        });
    }

    /// <summary>
    /// 新增交易记录（带验证）
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] StockTradeRequest request)
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

        var result = await _tradeService.CreateAsync(request);

        if (!result.Success)
        {
            return Conflict(new { success = false, message = result.Message });
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 批量新增交易记录
    /// </summary>
    [HttpPost("batch")]
    public async Task<IActionResult> BatchCreate([FromBody] BatchStockTradeRequest request)
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

        var result = await _tradeService.BatchCreateAsync(request);

        return Ok(new
        {
            success = result.Success,
            data = result.Data,
            message = result.Message,
            successCount = result.SuccessCount,
            failCount = result.FailCount,
            errors = result.Errors
        });
    }

    /// <summary>
    /// 批量修改交易记录
    /// </summary>
    [HttpPut("batch")]
    public async Task<IActionResult> BatchUpdate([FromBody] BatchTradeUpdateRequest request)
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

        var result = await _tradeService.BatchUpdateAsync(request);

        return Ok(new
        {
            success = result.Success,
            data = result.Data,
            message = result.Message,
            successCount = result.SuccessCount,
            failCount = result.FailCount,
            errors = result.Errors
        });
    }

    /// <summary>
    /// 修改交易记录
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] StockTradeRequest request)
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

        var result = await _tradeService.UpdateAsync(id, request);

        if (!result.Success)
        {
            return NotFound(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 删除交易记录
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _tradeService.DeleteAsync(id);

        if (!result.Success)
        {
            return NotFound(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            message = result.Message
        });
    }
}