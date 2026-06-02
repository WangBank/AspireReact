using AspireReact.Server.Data;
using AspireReact.Server.DTOs;
using AspireReact.Server.Entities;
using AspireReact.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IAccountService _accountService;
    private readonly IBankFlowService _bankFlowService;
    private readonly IStockTradeService _tradeService;
    private readonly IMarketIndexService _marketIndexService;
    private readonly AppDbContext _db;

    public DashboardController(
        AppDbContext db,
        IAccountService accountService,
        IBankFlowService bankFlowService,
        IStockTradeService tradeService,
        IMarketIndexService marketIndexService)
    {
        _db = db;
        _accountService = accountService;
        _bankFlowService = bankFlowService;
        _tradeService = tradeService;
        _marketIndexService = marketIndexService;
    }

    /// <summary>
    /// 获取首页概览统计数据
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var latestAccount = await _accountService.GetLatestAsync();
        var latestTradeDate = await GetLatestTradeDateAsync();
        var referenceDate = (latestTradeDate ?? latestAccount?.Date ?? DateTime.UtcNow.Date).Date;
        var latestRecordDate = latestTradeDate ?? latestAccount?.Date;
        var latestRecordDailyPnL = await GetLatestRecordDailyPnLAsync(latestRecordDate, latestAccount);
        var accountHistory = await _accountService.GetByDateRangeAsync(null, referenceDate);
        var todayPnL = accountHistory
            .Where(record => record.Date.Date == referenceDate)
            .Sum(record => record.DailyPnL);

        var weekStart = GetWeekStart(referenceDate);
        var weekPnL = accountHistory
            .Where(record => record.Date.Date >= weekStart && record.Date.Date <= referenceDate)
            .Sum(record => record.DailyPnL);

        var monthStart = new DateTime(referenceDate.Year, referenceDate.Month, 1);
        var monthPnL = accountHistory
            .Where(record => record.Date.Date >= monthStart && record.Date.Date <= referenceDate)
            .Sum(record => record.DailyPnL);

        var summary = await _tradeService.GetSummaryAsync(new TradeSummaryRequest());
        var cumulativePnL = summary.TotalPnL;
        var recentBankFlows = await _bankFlowService.GetRecentAsync();
        var periodDefinitions = BuildPeriodDefinitions(referenceDate, accountHistory, todayPnL, weekPnL, monthPnL, cumulativePnL);
        var bankFlows = await _db.BankFlows
            .AsNoTracking()
            .Where(item => item.Date <= referenceDate)
            .ToListAsync();
        var marketIndexSeries = await _marketIndexService.GetDailySeriesAsync(
            periodDefinitions.Min(item => item.StartDate).AddDays(-60),
            referenceDate);

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
            LatestRecordDate = latestRecordDate,
            LatestRecordDailyPnL = latestRecordDailyPnL,
            LatestAccount = latestAccount,
            RecentBankFlows = recentBankFlows,
            RecentTrades = recentTradesResult.Items,
            DailyPnLHeatmap = summary.DailyPnLHeatmap,
            PeriodSummaries = BuildPeriodSummaries(periodDefinitions, accountHistory, bankFlows, marketIndexSeries)
        };

        return Ok(new
        {
            success = true,
            data = dashboardData,
            message = "获取首页概览成功"
        });
    }

    /// <summary>
    /// 获取三类录入数据中最新的业务日期
    /// </summary>
    private async Task<DateTime?> GetLatestTradeDateAsync()
    {
        return await _db.StockTrades
            .AsNoTracking()
            .OrderByDescending(item => item.TradeDate)
            .Select(item => (DateTime?)item.TradeDate)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// 获取最近交易日期对应的当日盈亏
    /// 优先取账户日表，其次回退为当日交易记录的 dailyPnL 汇总
    /// </summary>
    private async Task<decimal> GetLatestRecordDailyPnLAsync(DateTime? latestRecordDate, AccountDailyResponse? latestAccount)
    {
        if (!latestRecordDate.HasValue)
        {
            return 0;
        }

        var targetDate = latestRecordDate.Value.Date;
        if (latestAccount?.Date.Date == targetDate)
        {
            return latestAccount.DailyPnL;
        }

        var matchedAccountPnL = await _db.AccountDailies
            .AsNoTracking()
            .Where(item => item.Date == targetDate)
            .Select(item => (decimal?)item.DailyPnL)
            .FirstOrDefaultAsync();

        if (matchedAccountPnL.HasValue)
        {
            return matchedAccountPnL.Value;
        }

        var matchedTradePnL = await _db.StockTrades
            .AsNoTracking()
            .Where(item => item.TradeDate == targetDate)
            .SumAsync(item => (decimal?)item.DailyPnL);

        return matchedTradePnL ?? 0;
    }

    private static DateTime GetWeekStart(DateTime date)
    {
        return date.AddDays(-(int)date.DayOfWeek + (date.DayOfWeek == DayOfWeek.Sunday ? -6 : 1)).Date;
    }

    private static List<DashboardPeriodDefinition> BuildPeriodDefinitions(
        DateTime referenceDate,
        IReadOnlyList<AccountDailyResponse> accountHistory,
        decimal todayPnL,
        decimal weekPnL,
        decimal monthPnL,
        decimal cumulativePnL)
    {
        var cumulativeStart = accountHistory.Count > 0
            ? accountHistory[0].Date.Date
            : referenceDate.Date;

        return
        [
            new DashboardPeriodDefinition("today", "今日盈亏", referenceDate.Date, referenceDate.Date, todayPnL),
            new DashboardPeriodDefinition("week", "本周盈亏", GetWeekStart(referenceDate), referenceDate.Date, weekPnL),
            new DashboardPeriodDefinition("month", "本月盈亏", new DateTime(referenceDate.Year, referenceDate.Month, 1), referenceDate.Date, monthPnL),
            new DashboardPeriodDefinition("cumulative", "累计盈亏", cumulativeStart, referenceDate.Date, cumulativePnL)
        ];
    }

    private static List<DashboardPeriodSummary> BuildPeriodSummaries(
        IReadOnlyList<DashboardPeriodDefinition> periodDefinitions,
        IReadOnlyList<AccountDailyResponse> accountHistory,
        IReadOnlyCollection<BankFlow> bankFlows,
        IReadOnlyList<MarketIndexSeries> marketIndexSeries)
    {
        return periodDefinitions
            .Select(period => new DashboardPeriodSummary
            {
                Key = period.Key,
                Label = period.Label,
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                Pnl = decimal.Round(period.PnL, 2, MidpointRounding.AwayFromZero),
                ReturnRate = ComputeAccountReturnRate(accountHistory, bankFlows, period.StartDate, period.EndDate),
                Benchmarks = marketIndexSeries
                    .Select(index => new DashboardBenchmarkSummary
                    {
                        Key = index.Key,
                        Name = index.Name,
                        ReturnRate = ComputeMarketIndexReturn(index.Bars, period.StartDate, period.EndDate)
                    })
                    .ToList()
            })
            .ToList();
    }

    private static decimal? ComputeAccountReturnRate(
        IReadOnlyList<AccountDailyResponse> accountHistory,
        IReadOnlyCollection<BankFlow> bankFlows,
        DateTime startDate,
        DateTime endDate)
    {
        if (accountHistory.Count == 0)
        {
            return null;
        }

        var flowByDate = bankFlows
            .GroupBy(item => item.Date.Date)
            .ToDictionary(
                group => group.Key,
                group => group.Sum(item => string.Equals(item.FlowType, "转入", StringComparison.Ordinal)
                    ? item.Amount
                    : -item.Amount));

        var factor = 1m;
        var hasValue = false;

        for (var index = 0; index < accountHistory.Count; index++)
        {
            var record = accountHistory[index];
            var recordDate = record.Date.Date;
            if (recordDate < startDate.Date || recordDate > endDate.Date)
            {
                continue;
            }

            decimal baseAssets;
            if (index > 0)
            {
                baseAssets = accountHistory[index - 1].TotalAssets;
            }
            else
            {
                flowByDate.TryGetValue(recordDate, out var sameDayFlow);
                baseAssets = record.TotalAssets - record.DailyPnL - sameDayFlow;
            }

            if (baseAssets <= 0)
            {
                continue;
            }

            factor *= 1 + (record.DailyPnL / baseAssets);
            hasValue = true;
        }

        return hasValue
            ? decimal.Round(factor - 1, 4, MidpointRounding.AwayFromZero)
            : null;
    }

    private static decimal? ComputeMarketIndexReturn(
        IReadOnlyList<MarketIndexDailyBar> bars,
        DateTime startDate,
        DateTime endDate)
    {
        if (bars.Count == 0)
        {
            return null;
        }

        var firstInRangeIndex = -1;
        var endIndex = -1;
        for (var index = 0; index < bars.Count; index++)
        {
            var barDate = bars[index].Date.Date;
            if (firstInRangeIndex < 0 && barDate >= startDate.Date && barDate <= endDate.Date)
            {
                firstInRangeIndex = index;
            }

            if (barDate <= endDate.Date)
            {
                endIndex = index;
            }
        }

        if (firstInRangeIndex < 0 || endIndex < firstInRangeIndex)
        {
            return null;
        }

        var endBar = bars[endIndex];
        if (endBar.Date.Date < endDate.Date.AddDays(-7))
        {
            return null;
        }

        var basePrice = firstInRangeIndex > 0
            ? bars[firstInRangeIndex - 1].Close
            : (bars[firstInRangeIndex].Open > 0 ? bars[firstInRangeIndex].Open : bars[firstInRangeIndex].Close);

        if (basePrice <= 0)
        {
            return null;
        }

        return decimal.Round((endBar.Close - basePrice) / basePrice, 4, MidpointRounding.AwayFromZero);
    }

    private sealed record DashboardPeriodDefinition(
        string Key,
        string Label,
        DateTime StartDate,
        DateTime EndDate,
        decimal PnL);
}
