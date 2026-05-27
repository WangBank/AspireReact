using System.ComponentModel.DataAnnotations;

namespace AspireReact.Server.DTOs;

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

    [MaxLength(2000, ErrorMessage = "交易笔记最多2000个字符")]
    public string? TradeNote { get; set; }

    [MaxLength(500, ErrorMessage = "同花顺链接最多500个字符")]
    public string? TonghuashunLink { get; set; }

    /// <summary>
    /// 自定义验证：必须至少有一方（买入或卖出）有有效数据
    /// </summary>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var hasBuy = BuyPrice > 0 && BuyQuantity > 0;
        var hasSell = SellPrice > 0 && SellQuantity > 0;

        if (!hasBuy && !hasSell)
        {
            yield return new ValidationResult(
                "买入或卖出至少需要填写一方（价格>0 且 数量>0）",
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

        // 买入卖出同时存在时，数量应该一致（等量对敲）
        if (hasBuy && hasSell && BuyQuantity != SellQuantity)
        {
            yield return new ValidationResult(
                "同时存在买入和卖出时，数量应保持一致（等量对敲），请分别录入",
                new[] { nameof(BuyQuantity), nameof(SellQuantity) });
        }
    }
}

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
    public StockTradeResponse? Data { get; set; }
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
}

/// <summary>
/// 统计汇总响应
/// </summary>
public class TradeSummaryResponse
{
    public int TotalTrades { get; set; }
    public decimal TotalPnL { get; set; }
    public int WinTrades { get; set; }
    public int LoseTrades { get; set; }
    public decimal OverallWinRate { get; set; }
    public List<TradeSummaryItem> ByStock { get; set; } = new();
    public List<TradeSummaryItem> ByBoard { get; set; } = new();
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