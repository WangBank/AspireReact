namespace AspireReact.Server.Entities;

public class StockBasic
{
    public int Id { get; set; }
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string? StockAbbr { get; set; }
    public string Board { get; set; } = string.Empty; // 主板/创业板/科创板/北交所
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public DateTime? CacheExpiry { get; set; }
}