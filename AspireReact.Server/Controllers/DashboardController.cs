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
        // 数据库存的是按 UTC 零点落库的日期，这里统一按 UTC 日期取范围，避免本地时区导致当天记录被漏掉。
        var today = DateTime.UtcNow.Date;
        var latestAccount = await _accountService.GetLatestAsync();

        // 今日/本周/本月优先使用账户日表中的当日盈亏，避免连续持仓快照重复影响区间统计。
        var todayPnL = await CalculateAccountDailyPnL(today, today);

        var weekStart = today.AddDays(-(int)today.DayOfWeek + (today.DayOfWeek == DayOfWeek.Sunday ? -6 : 1));
        var weekPnL = await CalculateAccountDailyPnL(weekStart, today);

        var monthStart = new DateTime(today.Year, today.Month, 1);
        var monthPnL = await CalculateAccountDailyPnL(monthStart, today);

        var cumulativePnL = await CalculateCumulativePnL();

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
    /// 按日期范围汇总账户当日盈亏
    /// </summary>
    private async Task<decimal> CalculateAccountDailyPnL(DateTime? startDate, DateTime? endDate)
    {
        var accountRecords = await _accountService.GetByDateRangeAsync(startDate, endDate);
        return accountRecords.Sum(record => record.DailyPnL);
    }

    /// <summary>
    /// 计算累计盈亏：基于持仓/交易统计的有效周期口径
    /// </summary>
    private async Task<decimal> CalculateCumulativePnL()
    {
        var summary = await _tradeService.GetSummaryAsync(new TradeSummaryRequest
        {
        });
        return summary.TotalPnL;
    }
}
