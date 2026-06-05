using System.ComponentModel.DataAnnotations;

namespace Lies.Server.DTOs;

/// <summary>
/// 新增/修改心魔交易记录请求
/// </summary>
public class StockTradeRequest : IValidatableObject
{
    [Required(ErrorMessage = "交易日期不能为空")]
    public DateTime TradeDate { get; set; }

    [Required(ErrorMessage = "心魔代码不能为空")]
    [MaxLength(10, ErrorMessage = "心魔代码最多10个字符")]
    public string StockCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "心魔名称不能为空")]
    [MaxLength(50, ErrorMessage = "心魔名称最多50个字符")]
    public string StockName { get; set; } = string.Empty;

    [Required(ErrorMessage = "板块不能为空")]
    [RegularExpression("^(主板|创业板|科创板|北交所)$", ErrorMessage = "板块必须为主板/创业板/科创板/北交所")]
    public string Board { get; set; } = string.Empty;

    [Range(0, 999999.99, ErrorMessage = "买入价格范围不合法")]
    public decimal BuyPrice { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "买入数量不能为负数")]
    public int BuyQuantity { get; set; }

    [Range(0, 999999.99, ErrorMessage = "卖出价格范围不合法")]
    public decimal SellPrice { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "卖出数量不能为负数")]
    public int SellQuantity { get; set; }

    public decimal PositionPnL { get; set; }

    public decimal CumulativePnL { get; set; }

    public decimal CostPrice { get; set; }

    public decimal CurrentPrice { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "持仓数量不能为负数")]
    public int PositionQuantity { get; set; }

    public decimal DailyPnL { get; set; }

    /// <summary>
    /// 是否清仓：清仓模式下只记录盈亏，不记录持仓相关数据
    /// </summary>
    public bool IsLiquidated { get; set; }

    [MaxLength(50, ErrorMessage = "卖出原因最多50个字符")]
    public string? SellReason { get; set; }

    [MaxLength(20, ErrorMessage = "情绪标签最多20个")]
    public List<string>? EmotionTags { get; set; }

    [MaxLength(20, ErrorMessage = "交易标签最多20个")]
    public List<string>? TradeTags { get; set; }

    [MaxLength(2000, ErrorMessage = "交易笔记最多2000个字符")]
    public string? TradeNote { get; set; }

    [MaxLength(500, ErrorMessage = "同花顺链接最多500个字符")]
    public string? TonghuashunLink { get; set; }

    /// <summary>
    /// 自定义验证
    /// 支持五种模式：纯买入、纯卖出、同日有买有卖、纯持仓快照、清仓模式
    /// </summary>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!string.IsNullOrWhiteSpace(SellReason) && SellReason.Trim().Length > 50)
        {
            yield return new ValidationResult(
                "卖出原因最多50个字符",
                new[] { nameof(SellReason) });
        }

        if (EmotionTags is { Count: > 0 })
        {
            if (EmotionTags.Count > 20)
            {
                yield return new ValidationResult(
                    "情绪标签最多20个",
                    new[] { nameof(EmotionTags) });
            }

            if (EmotionTags.Any(tag => !string.IsNullOrWhiteSpace(tag) && tag.Trim().Length > 20))
            {
                yield return new ValidationResult(
                    "单个情绪标签最多20个字符",
                    new[] { nameof(EmotionTags) });
            }
        }

        if (TradeTags is { Count: > 0 })
        {
            if (TradeTags.Count > 20)
            {
                yield return new ValidationResult(
                    "交易标签最多20个",
                    new[] { nameof(TradeTags) });
            }

            if (TradeTags.Any(tag => !string.IsNullOrWhiteSpace(tag) && tag.Trim().Length > 20))
            {
                yield return new ValidationResult(
                    "单个交易标签最多20个字符",
                    new[] { nameof(TradeTags) });
            }
        }

        // 清仓模式：允许只填写盈亏相关字段，跳过持仓验证
        if (IsLiquidated)
        {
            yield break;
        }

        var hasBuy = BuyPrice > 0 && BuyQuantity > 0;
        var hasSell = SellPrice > 0 && SellQuantity > 0;
        var isPositionOnly = !hasBuy && !hasSell
            && (PositionQuantity > 0
                || CostPrice > 0
                || CurrentPrice > 0
                || PositionPnL != 0
                || CumulativePnL != 0
                || DailyPnL != 0);

        // 纯持仓模式：买入卖出均为0，仅记录持仓市值，跳过交易验证
        if (isPositionOnly)
        {
            yield break;
        }

        if (!hasBuy && !hasSell)
        {
            yield return new ValidationResult(
                "买入或卖出至少需要填写一方（价格>0 且 数量>0），或填写持仓市值，或勾选清仓",
                new[] { nameof(BuyPrice), nameof(SellPrice) });
        }

        // 买入数据不完整时的提示
        if ((BuyPrice > 0 && BuyQuantity == 0) || (BuyPrice == 0 && BuyQuantity > 0))
        {
            yield return new ValidationResult(
                "买入价格和数量必须同时填写或同时为空",
                new[] { nameof(BuyPrice), nameof(BuyQuantity) });
        }

        // 卖出数据不完整时的提示
        if ((SellPrice > 0 && SellQuantity == 0) || (SellPrice == 0 && SellQuantity > 0))
        {
            yield return new ValidationResult(
                "卖出价格和数量必须同时填写或同时为空",
                new[] { nameof(SellPrice), nameof(SellQuantity) });
        }
    }
}

/// <summary>
/// 修改心魔交易记录请求（复用 StockTradeRequest，此处为别名，便于语义区分）
/// </summary>
public class StockTradeUpdateRequest : StockTradeRequest { }

/// <summary>
/// 心魔交易记录响应
/// </summary>
public class StockTradeResponse
{
    public int Id { get; set; }
    public DateTime TradeDate { get; set; }
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string Board { get; set; } = string.Empty;
    public decimal BuyPrice { get; set; }
    public int BuyQuantity { get; set; }
    public decimal SellPrice { get; set; }
    public int SellQuantity { get; set; }
    public decimal PositionPnL { get; set; }
    public decimal CumulativePnL { get; set; }
    public decimal CostPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public int PositionQuantity { get; set; }
    public decimal DailyPnL { get; set; }
    public bool IsLiquidated { get; set; }
    public string? SellReason { get; set; }
    public List<string> EmotionTags { get; set; } = new();
    public List<string> TradeTags { get; set; } = new();
    public string? TradeNote { get; set; }
    public string? TonghuashunLink { get; set; }
}

/// <summary>
/// 心魔交易操作结果
/// </summary>
public class StockTradeResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ErrorCode { get; set; }
    public StockTradeResponse? Data { get; set; }
}

/// <summary>
/// 批量新增交易记录请求
/// </summary>
public class BatchStockTradeRequest
{
    [Required(ErrorMessage = "交易记录列表不能为空")]
    [MinLength(1, ErrorMessage = "至少需要一条交易记录")]
    public List<StockTradeRequest> Trades { get; set; } = new();
}

/// <summary>
/// 批量修改交易记录中的单条（ID + 数据）
/// </summary>
public class BatchTradeUpdateItem
{
    [Required(ErrorMessage = "记录 ID 不能为空")]
    public int Id { get; set; }

    [Required(ErrorMessage = "交易数据不能为空")]
    public StockTradeRequest Data { get; set; } = new();
}

/// <summary>
/// 批量修改交易记录请求
/// </summary>
public class BatchTradeUpdateRequest
{
    [Required(ErrorMessage = "交易记录列表不能为空")]
    [MinLength(1, ErrorMessage = "至少需要一条交易记录")]
    public List<BatchTradeUpdateItem> Trades { get; set; } = new();
}

/// <summary>
/// 批量操作结果
/// </summary>
public class BatchStockTradeResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int SuccessCount { get; set; }
    public int FailCount { get; set; }
    public List<StockTradeResponse>? Data { get; set; }
    public List<string>? Errors { get; set; }
}

/// <summary>
/// 多条件筛选查询参数
/// </summary>
public class TradeQueryRequest
{
    public string? StockCode { get; set; }
    public DateTime? TradeDateStart { get; set; }
    public DateTime? TradeDateEnd { get; set; }
    public string? Board { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

/// <summary>
/// 统计汇总请求参数
/// </summary>
public class TradeSummaryRequest
{
    /// <summary>
    /// 统计起始日期
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// 统计截止日期
    /// </summary>
    public DateTime? EndDate { get; set; }

    /// <summary>
    /// 按心魔聚合（默认按心魔汇总盈亏）
    /// </summary>
    public string? StockCode { get; set; }

    /// <summary>
    /// 按板块过滤
    /// </summary>
    public string? Board { get; set; }
}

/// <summary>
/// 统计汇总响应（单只心魔的盈亏汇总）
/// </summary>
public class TradeSummaryItem
{
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string Board { get; set; } = string.Empty;
    public int TradeCount { get; set; }
    public decimal TotalPositionPnL { get; set; }
    public decimal TotalCumulativePnL { get; set; }
    public decimal WinRate { get; set; }
    public decimal ContributionRate { get; set; }
}

public class TradeBehaviorSummaryItem
{
    public string Label { get; set; } = string.Empty;
    public int TradeCount { get; set; }
    public int WinCount { get; set; }
    public int LoseCount { get; set; }
    public decimal WinRate { get; set; }
    public decimal TotalPnL { get; set; }
    public decimal AveragePnL { get; set; }
}

/// <summary>
/// 统计汇总响应
/// </summary>
public class TradeSummaryResponse
{
    // ── 交易统计（仅包含有实际买卖操作的记录） ──
    public int TotalTrades { get; set; }
    public decimal TotalPnL { get; set; }
    public decimal RealizedPnL { get; set; }
    public decimal UnrealizedPnL { get; set; }
    public decimal NetBankFlow { get; set; }
    public decimal TotalBankInflow { get; set; }
    public decimal TotalBankOutflow { get; set; }
    public decimal CurrentTotalAmount { get; set; }
    public int WinTrades { get; set; }
    public int LoseTrades { get; set; }
    public decimal OverallWinRate { get; set; }
    public List<TradeSummaryItem> ByStock { get; set; } = new();
    public List<TradeSummaryItem> ByBoard { get; set; } = new();

    // ── 持仓汇总（仅包含纯持仓记录：无买卖操作、未清仓、有持仓数量） ──
    public int PositionCount { get; set; }
    public decimal TotalPositionValue { get; set; }
    public decimal TotalPositionPnL { get; set; }
    public decimal TotalDailyPnL { get; set; }
    public List<PositionSummaryItem> Positions { get; set; } = new();
    public List<TradeBehaviorSummaryItem> BySellReason { get; set; } = new();
    public List<TradeBehaviorSummaryItem> ByEmotionTag { get; set; } = new();
    public List<TradeBehaviorSummaryItem> ByTradeTag { get; set; } = new();

    // ── 分析视图 ──
    public List<DailyWinRateItem> DailyWinRates { get; set; } = new();
    public DailyWinRateItem? BestWinRateDay { get; set; }
    public DailyWinRateItem? WorstWinRateDay { get; set; }
    public PnLIntervalAnalysisItem? BestProfitInterval { get; set; }
    public DrawdownAnalysisItem? MaxDrawdownInterval { get; set; }
    public AdjustedReturnSummary? AdjustedReturn { get; set; }
    public DayOutcomeSummary? DayOutcomes { get; set; }
    public StreakAnalysisSummary? StreakAnalysis { get; set; }
    public CycleAnalysisSummary? CycleAnalysis { get; set; }
    public List<CycleDetailItem> CycleDetails { get; set; } = new();
    public TTradeAnalysisSummary? TTradeAnalysis { get; set; }
    public List<TTradeDetailItem> TTradeDetails { get; set; } = new();
    public CapitalAnalysisSummary? CapitalAnalysis { get; set; }
    public List<DailyPnLHeatmapItem> DailyPnLHeatmap { get; set; } = new();
    public List<PeriodPnLDistributionItem> WeeklyPnL { get; set; } = new();
    public List<PeriodPnLDistributionItem> MonthlyPnL { get; set; } = new();
    public List<PeriodPnLDistributionItem> QuarterlyPnL { get; set; } = new();
    public List<BoardRotationItem> BoardRotations { get; set; } = new();
}

/// <summary>
/// 持仓汇总项
/// </summary>
public class PositionSummaryItem
{
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string Board { get; set; } = string.Empty;
    public int PositionQuantity { get; set; }
    public decimal CostPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal PositionPnL { get; set; }
    public decimal DailyPnL { get; set; }
    public DateTime LastUpdateDate { get; set; }
    public DateTime? OpenDate { get; set; }
    public int HoldingDays { get; set; }
}

/// <summary>
/// 日度胜率分析项
/// </summary>
public class DailyWinRateItem
{
    public DateTime Date { get; set; }
    public int WinCount { get; set; }
    public int LoseCount { get; set; }
    public decimal WinRate { get; set; }
    public decimal TotalPnL { get; set; }
}

/// <summary>
/// 盈亏区间分析项
/// </summary>
public class PnLIntervalAnalysisItem
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int TradingDays { get; set; }
    public decimal TotalPnL { get; set; }
}

/// <summary>
/// 回撤区间分析项
/// </summary>
public class DrawdownAnalysisItem
{
    public DateTime PeakDate { get; set; }
    public DateTime TroughDate { get; set; }
    public decimal PeakValue { get; set; }
    public decimal TroughValue { get; set; }
    public decimal DrawdownAmount { get; set; }
    public decimal DrawdownRate { get; set; }
    public DateTime? RecoveryDate { get; set; }
    public int? RecoveryDays { get; set; }
}

/// <summary>
/// 净入金修正收益率
/// </summary>
public class AdjustedReturnSummary
{
    public decimal? ReturnRate { get; set; }
    public decimal StartAssets { get; set; }
    public decimal EndAssets { get; set; }
    public decimal NetBankFlow { get; set; }
    public decimal WeightedCapitalBase { get; set; }
}

/// <summary>
/// 日度盈亏热力图项
/// </summary>
public class DailyPnLHeatmapItem
{
    public DateTime Date { get; set; }
    public decimal DailyPnL { get; set; }
    public decimal? TotalAssets { get; set; }
    public decimal NetBankFlow { get; set; }
    public decimal? CapitalUtilization { get; set; }
}

/// <summary>
/// 盈亏日分布
/// </summary>
public class DayOutcomeSummary
{
    public int ProfitDays { get; set; }
    public int LossDays { get; set; }
    public int FlatDays { get; set; }
    public decimal ProfitDayRate { get; set; }
    public decimal LossDayRate { get; set; }
    public decimal FlatDayRate { get; set; }
}

/// <summary>
/// 连胜连亏分析
/// </summary>
public class StreakAnalysisSummary
{
    public int MaxWinDays { get; set; }
    public DateTime? MaxWinStartDate { get; set; }
    public DateTime? MaxWinEndDate { get; set; }
    public int MaxLossDays { get; set; }
    public DateTime? MaxLossStartDate { get; set; }
    public DateTime? MaxLossEndDate { get; set; }
}

/// <summary>
/// 周期分析摘要
/// </summary>
public class CycleAnalysisSummary
{
    public int TotalCycles { get; set; }
    public int ClosedCycles { get; set; }
    public int OpenCycles { get; set; }
    public decimal ClosedWinRate { get; set; }
    public decimal AverageProfitPerCycle { get; set; }
    public decimal AverageLossPerCycle { get; set; }
    public decimal AverageHoldingDays { get; set; }
    public decimal MaxProfitCyclePnL { get; set; }
    public decimal MaxLossCyclePnL { get; set; }
}

/// <summary>
/// 单个交易周期明细
/// </summary>
public class CycleDetailItem
{
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string Board { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int HoldingDays { get; set; }
    public decimal TotalPnL { get; set; }
    public bool IsClosed { get; set; }
}

/// <summary>
/// 做T分析摘要
/// </summary>
public class TTradeAnalysisSummary
{
    public int TradeCount { get; set; }
    public int WinCount { get; set; }
    public int LoseCount { get; set; }
    public decimal WinRate { get; set; }
    public decimal TotalPnL { get; set; }
    public decimal AveragePnL { get; set; }
}

/// <summary>
/// 单条做T明细
/// </summary>
public class TTradeDetailItem
{
    public DateTime TradeDate { get; set; }
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string Board { get; set; } = string.Empty;
    public decimal BuyPrice { get; set; }
    public int BuyQuantity { get; set; }
    public decimal SellPrice { get; set; }
    public int SellQuantity { get; set; }
    public int PositionQuantity { get; set; }
    public decimal DailyPnL { get; set; }
    public bool IsLiquidated { get; set; }
}

/// <summary>
/// 资金使用率与波动率分析
/// </summary>
public class CapitalAnalysisSummary
{
    public decimal? LatestUtilization { get; set; }
    public decimal? AverageUtilization { get; set; }
    public decimal? MaxUtilization { get; set; }
    public decimal? DailyVolatility { get; set; }
}

/// <summary>
/// 周/月/季度盈亏分布
/// </summary>
public class PeriodPnLDistributionItem
{
    public string Label { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalPnL { get; set; }
}

/// <summary>
/// 板块轮动复盘
/// </summary>
public class BoardRotationItem
{
    public string Board { get; set; } = string.Empty;
    public decimal TotalPnL { get; set; }
    public decimal ContributionRate { get; set; }
    public int ActiveDays { get; set; }
    public int ProfitDays { get; set; }
    public int LossDays { get; set; }
    public decimal WinDayRate { get; set; }
}

/// <summary>
/// 分页结果
/// </summary>
public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)Total / PageSize) : 0;
}
