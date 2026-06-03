using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace Lies.Server.DTOs;

/// <summary>
/// 券商持仓截图识别请求
/// </summary>
public class PortfolioScreenshotImportRequest
{
    [Required(ErrorMessage = "请上传截图文件")]
    public IFormFile? Image { get; set; }

    public DateTime? ImportDate { get; set; }
}

/// <summary>
/// 券商持仓截图识别响应
/// </summary>
public class PortfolioScreenshotImportResponse
{
    public int AuditId { get; set; }
    public DateTime? RecognizedDate { get; set; }
    public PortfolioAccountImportResponse? Account { get; set; }
    public PortfolioBankFlowImportResponse? BankFlow { get; set; }
    public List<PortfolioPositionImportResponse> Positions { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

/// <summary>
/// 识别出的账户汇总数据
/// </summary>
public class PortfolioAccountImportResponse
{
    public decimal TotalAssets { get; set; }
    public decimal PositionValue { get; set; }
    public decimal AvailableFunds { get; set; }
    public decimal DailyPnL { get; set; }
}

/// <summary>
/// 识别出的银证流水数据
/// </summary>
public class PortfolioBankFlowImportResponse
{
    public DateTime Date { get; set; }
    public string FlowType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Remark { get; set; }
}

/// <summary>
/// 识别出的单条持仓数据
/// </summary>
public class PortfolioPositionImportResponse
{
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public string Board { get; set; } = string.Empty;
    public decimal BuyPrice { get; set; }
    public int BuyQuantity { get; set; }
    public decimal SellPrice { get; set; }
    public int SellQuantity { get; set; }
    public int PositionQuantity { get; set; }
    public decimal CostPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal PositionPnL { get; set; }
    public decimal CumulativePnL { get; set; }
    public decimal DailyPnL { get; set; }
    public decimal MarketValue { get; set; }
    public bool IsLiquidated { get; set; }
}

/// <summary>
/// 截图识别服务执行结果
/// </summary>
public class PortfolioScreenshotImportResult
{
    public bool Success { get; set; }
    public int StatusCode { get; set; } = StatusCodes.Status200OK;
    public string Message { get; set; } = string.Empty;
    public PortfolioScreenshotImportResponse? Data { get; set; }
}

public class PortfolioImportAuditListItemResponse
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ImportDate { get; set; }
    public DateTime? RecognizedDate { get; set; }
    public string SourceFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public bool ParseSuccess { get; set; }
    public string ParseMessage { get; set; } = string.Empty;
    public int PositionCount { get; set; }
    public int WarningCount { get; set; }
    public bool SaveAttempted { get; set; }
    public string? SaveStatus { get; set; }
    public bool SavedAccount { get; set; }
    public bool SavedBankFlow { get; set; }
    public bool SavedTrades { get; set; }
    public int RequestedTradeCount { get; set; }
    public int SavedTradeCount { get; set; }
    public string? SaveMessage { get; set; }
}

public class PortfolioImportAuditFinalPayload
{
    public AccountDailyRequest? FinalAccount { get; set; }
    public BankFlowRequest? FinalBankFlow { get; set; }
    public List<StockTradeRequest> FinalTrades { get; set; } = new();
}

public class PortfolioImportAuditSaveResult
{
    public bool SaveSucceeded { get; set; }
    public bool SavedAccount { get; set; }
    public bool SavedBankFlow { get; set; }
    public bool SavedTrades { get; set; }
    public int RequestedTradeCount { get; set; }
    public int SavedTradeCount { get; set; }
    public string? SaveStatus { get; set; }
    public string? SaveMessage { get; set; }
    public List<string> SaveErrors { get; set; } = new();
    public DateTime? SaveCompletedAt { get; set; }
}

public class PortfolioImportAuditDetailResponse : PortfolioImportAuditListItemResponse
{
    public bool HasImage { get; set; }
    public string? RecognizedText { get; set; }
    public PortfolioScreenshotImportResponse? RecognizedPayload { get; set; }
    public PortfolioImportAuditFinalPayload? FinalPayload { get; set; }
    public PortfolioImportAuditSaveResult? SaveResult { get; set; }
}

public class PortfolioImportAuditFinalizeRequest
{
    public AccountDailyRequest? FinalAccount { get; set; }
    public BankFlowRequest? FinalBankFlow { get; set; }
    public List<StockTradeRequest> FinalTrades { get; set; } = new();
    public bool SaveSucceeded { get; set; }
    public bool SavedAccount { get; set; }
    public bool SavedBankFlow { get; set; }
    public bool SavedTrades { get; set; }
    public int RequestedTradeCount { get; set; }
    public int SavedTradeCount { get; set; }
    [MaxLength(2000, ErrorMessage = "保存结果说明最多 2000 个字符")]
    public string? SaveMessage { get; set; }
    public List<string> SaveErrors { get; set; } = new();
}
