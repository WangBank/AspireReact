namespace Lies.Server.DTOs;

public class DataHealthFindingResponse
{
    public string Severity { get; set; } = "info";
    public string Category { get; set; } = string.Empty;
    public DateTime? BusinessDate { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? StockCode { get; set; }
    public string? StockName { get; set; }
    public decimal? CurrentValue { get; set; }
    public decimal? ExpectedValue { get; set; }
    public decimal? Difference { get; set; }
    public string? SuggestedAction { get; set; }
}

public class DataHealthReportResponse
{
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public int TotalFindings { get; set; }
    public int ErrorCount { get; set; }
    public int WarningCount { get; set; }
    public int InfoCount { get; set; }
    public int AccountDayCount { get; set; }
    public int TradeRecordCount { get; set; }
    public int TradeDayCount { get; set; }
    public int BankFlowDayCount { get; set; }
    public int AuditCount { get; set; }
    public int PendingAuditCount { get; set; }
    public int FailedAuditCount { get; set; }
    public List<DataHealthFindingResponse> Findings { get; set; } = new();
}
