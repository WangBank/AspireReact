namespace AspireReact.Server.DTOs;

/// <summary>
/// 股票搜索响应
/// </summary>
public class StockSearchResponse
{
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string? StockAbbr { get; set; }
    public string Board { get; set; } = string.Empty;
}

/// <summary>
/// 股票缓存统计响应
/// </summary>
public class StockCacheStatsResponse
{
    public int CachedStockCount { get; set; }
    public string? LastRefreshTime { get; set; }
    public string Message { get; set; } = string.Empty;
}