namespace Lies.Server.Entities;

public class PortfolioImportAudit
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ImportDate { get; set; }
    public DateTime? RecognizedDate { get; set; }
    public string SourceFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public bool ParseSuccess { get; set; }
    public string ParseMessage { get; set; } = string.Empty;
    public int PositionCount { get; set; }
    public int WarningCount { get; set; }
    public string? StoredImagePath { get; set; }
    public string? RecognizedText { get; set; }
    public string? RecognizedPayloadJson { get; set; }
    public bool SaveAttempted { get; set; }
    public DateTime? SaveCompletedAt { get; set; }
    public string? SaveStatus { get; set; }
    public bool SavedAccount { get; set; }
    public bool SavedBankFlow { get; set; }
    public bool SavedTrades { get; set; }
    public int RequestedTradeCount { get; set; }
    public int SavedTradeCount { get; set; }
    public string? FinalPayloadJson { get; set; }
    public string? SaveErrorsJson { get; set; }
    public string? SaveMessage { get; set; }
}
