using AspireReact.Server.DTOs;

namespace AspireReact.Server.DTOs;

/// <summary>
/// 首页概览响应
/// </summary>
public class DashboardResponse
{
    /// <summary>
    /// 今日盈亏
    /// </summary>
    public decimal TodayPnL { get; set; }

    /// <summary>
    /// 本周盈亏
    /// </summary>
    public decimal WeekPnL { get; set; }

    /// <summary>
    /// 本月盈亏
    /// </summary>
    public decimal MonthPnL { get; set; }

    /// <summary>
    /// 累计盈亏
    /// </summary>
    public decimal CumulativePnL { get; set; }

    /// <summary>
    /// 最近一次录入的业务日期
    /// </summary>
    public DateTime? LatestRecordDate { get; set; }

    /// <summary>
    /// 最近交易日期对应的当日盈亏
    /// </summary>
    public decimal LatestRecordDailyPnL { get; set; }

    /// <summary>
    /// 最新账户资金记录
    /// </summary>
    public AccountDailyResponse? LatestAccount { get; set; }

    /// <summary>
    /// 最近银证流水记录（最多10条）
    /// </summary>
    public List<BankFlowResponse> RecentBankFlows { get; set; } = new();

    /// <summary>
    /// 最近交易记录（最多5条）
    /// </summary>
    public List<StockTradeResponse> RecentTrades { get; set; } = new();

    /// <summary>
    /// 日度盈亏日历数据
    /// </summary>
    public List<DailyPnLHeatmapItem> DailyPnLHeatmap { get; set; } = new();

    /// <summary>
    /// 首页区间概览卡片
    /// </summary>
    public List<DashboardPeriodSummary> PeriodSummaries { get; set; } = new();
}

public class DashboardPeriodSummary
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal Pnl { get; set; }
    public decimal? ReturnRate { get; set; }
    public List<DashboardBenchmarkSummary> Benchmarks { get; set; } = new();
}

public class DashboardBenchmarkSummary
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal? ReturnRate { get; set; }
}
