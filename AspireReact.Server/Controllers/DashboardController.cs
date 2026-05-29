using AspireReact.Server.DTOs;
using AspireReact.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IAccountService _accountService;
    private readonly IBankFlowService _bankFlowService;
    private readonly IStockTradeService _tradeService;

    public DashboardController(
        IAccountService accountService,
        IBankFlowService bankFlowService,
        IStockTradeService tradeService)
    {
        _accountService = accountService;
        _bankFlowService = bankFlowService;
        _tradeService = tradeService;
    }

    /// <summary>
    /// 获取首页概览统计数据
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var today = DateTime.Today;

        // 计算今日/本周/本月/累计盈亏
        var todayPnL = await CalculatePnL(today, today);

        var weekStart = today.AddDays(-(int)today.DayOfWeek + (today.DayOfWeek == DayOfWeek.Sunday ? -6 : 1));
        var weekPnL = await CalculatePnL(weekStart, today);

        var monthStart = new DateTime(today.Year, today.Month, 1);
        var monthPnL = await CalculatePnL(monthStart, today);

        var cumulativePnL = await CalculatePnL(null, null);

        // 获取最近记录
        var latestAccount = await _accountService.GetLatestAsync();
        var recentBankFlows = await _bankFlowService.GetRecentAsync();

        // 获取最近交易记录（最近5条，按交易日期倒序）
        var tradeQuery = new TradeQueryRequest
        {
            Page = 1,
            PageSize = 5
        };
        var recentTradesResult = await _tradeService.QueryAsync(tradeQuery);

        var dashboardData = new DashboardResponse
        {
            TodayPnL = todayPnL,
            WeekPnL = weekPnL,
            MonthPnL = monthPnL,
            CumulativePnL = cumulativePnL,
            LatestAccount = latestAccount,
            RecentBankFlows = recentBankFlows,
            RecentTrades = recentTradesResult.Items
        };

        return Ok(new
        {
            success = true,
            data = dashboardData,
            message = "获取首页概览成功"
        });
    }

    /// <summary>
    /// 按日期范围计算持仓盈亏总和（基于 StockTrade.PositionPnL）
    /// </summary>
    private async Task<decimal> CalculatePnL(DateTime? startDate, DateTime? endDate)
    {
        var summary = await _tradeService.GetSummaryAsync(new TradeSummaryRequest
        {
            StartDate = startDate,
            EndDate = endDate
        });
        return summary.TotalPnL;
    }
}