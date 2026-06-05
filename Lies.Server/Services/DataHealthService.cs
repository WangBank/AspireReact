using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Services;

public class DataHealthService : IDataHealthService
{
    private readonly AppDbContext _db;

    public DataHealthService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<DataHealthReportResponse> BuildReportAsync(int userId, CancellationToken cancellationToken = default)
    {
        var accounts = await _db.AccountDailies
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.Date)
            .ToListAsync(cancellationToken);
        var bankFlows = await _db.BankFlows
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.Date)
            .ToListAsync(cancellationToken);
        var trades = await _db.StockTrades
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.TradeDate)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        var notes = await _db.TradeNotes
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.Date)
            .ToListAsync(cancellationToken);
        var audits = await _db.PortfolioImportAudits
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        var findings = new List<DataHealthFindingResponse>();

        AddAccountBalanceFindings(accounts, findings);
        AddDuplicateTradeFindings(trades, findings);
        AddLiquidationMismatchFindings(trades, findings);
        AddHoldingPriceFindings(trades, findings);
        AddMissingAccountForTradeDayFindings(accounts, trades, findings);
        AddMissingAccountForBankFlowDayFindings(accounts, bankFlows, findings);
        AddAccountTradePnlGapFindings(accounts, trades, findings);
        AddOrphanNoteFindings(notes, trades, findings);
        AddAuditFindings(audits, findings);

        var orderedFindings = findings
            .OrderBy(finding => GetSeverityRank(finding.Severity))
            .ThenByDescending(finding => finding.BusinessDate ?? DateTime.MinValue)
            .ThenBy(finding => finding.Category, StringComparer.Ordinal)
            .ThenBy(finding => finding.Title, StringComparer.Ordinal)
            .ToList();

        return new DataHealthReportResponse
        {
            GeneratedAt = DateTime.UtcNow,
            TotalFindings = orderedFindings.Count,
            ErrorCount = orderedFindings.Count(item => IsSeverity(item, "error")),
            WarningCount = orderedFindings.Count(item => IsSeverity(item, "warning")),
            InfoCount = orderedFindings.Count(item => IsSeverity(item, "info")),
            AccountDayCount = accounts.Count,
            TradeRecordCount = trades.Count,
            TradeDayCount = trades.Select(item => item.TradeDate.Date).Distinct().Count(),
            BankFlowDayCount = bankFlows.Select(item => item.Date.Date).Distinct().Count(),
            AuditCount = audits.Count,
            PendingAuditCount = audits.Count(item => item.ParseSuccess && !item.SaveAttempted),
            FailedAuditCount = audits.Count(item => !item.ParseSuccess || IsStatus(item.SaveStatus, "failed") || IsStatus(item.SaveStatus, "partial")),
            Findings = orderedFindings
        };
    }

    private static void AddAccountBalanceFindings(
        IEnumerable<AccountDaily> accounts,
        ICollection<DataHealthFindingResponse> findings)
    {
        foreach (var account in accounts)
        {
            var expected = account.PositionValue + account.AvailableFunds;
            var difference = decimal.Round(account.TotalAssets - expected, 2, MidpointRounding.AwayFromZero);
            var absoluteDifference = Math.Abs(difference);
            if (absoluteDifference < 1)
            {
                continue;
            }

            findings.Add(new DataHealthFindingResponse
            {
                Severity = absoluteDifference >= 100 ? "error" : "warning",
                Category = "账户资金",
                BusinessDate = account.Date.Date,
                Title = "总资产与持仓市值 + 可用资金不一致",
                Description = $"总资产 {account.TotalAssets:F2} 与持仓市值 + 可用资金 {expected:F2} 相差 {difference:F2}。",
                CurrentValue = account.TotalAssets,
                ExpectedValue = expected,
                Difference = difference,
                SuggestedAction = "请检查账户资金录入、OCR 回填结果，或确认是否存在在途资金。"
            });
        }
    }

    private static void AddDuplicateTradeFindings(
        IEnumerable<StockTrade> trades,
        ICollection<DataHealthFindingResponse> findings)
    {
        var duplicates = trades
            .GroupBy(item => new { Date = item.TradeDate.Date, item.StockCode, item.StockName })
            .Where(group => group.Count() > 1);

        foreach (var group in duplicates)
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "error",
                Category = "交易记录",
                BusinessDate = group.Key.Date,
                Title = "同一只股票同一天存在多条记录",
                Description = $"{group.Key.StockName}（{group.Key.StockCode}）在 {group.Key.Date:yyyy-MM-dd} 有 {group.Count()} 条记录，容易导致持仓盈亏与累计盈亏重复计算。",
                StockCode = group.Key.StockCode,
                StockName = group.Key.StockName,
                CurrentValue = group.Count(),
                SuggestedAction = "请检查是否需要合并同日记录，或删除重复导入的数据。"
            });
        }
    }

    private static void AddLiquidationMismatchFindings(
        IEnumerable<StockTrade> trades,
        ICollection<DataHealthFindingResponse> findings)
    {
        foreach (var trade in trades.Where(item =>
                     item.IsLiquidated
                     && (item.PositionQuantity > 0 || item.CostPrice > 0 || item.CurrentPrice > 0)))
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "error",
                Category = "交易记录",
                BusinessDate = trade.TradeDate.Date,
                Title = "清仓记录仍保留持仓字段",
                Description = $"{trade.StockName}（{trade.StockCode}）已标记清仓，但仍保留持仓数量或价格字段。",
                StockCode = trade.StockCode,
                StockName = trade.StockName,
                CurrentValue = trade.PositionQuantity,
                SuggestedAction = "请检查这条清仓记录，清仓模式下应只保留盈亏结果，不应再保留持仓字段。"
            });
        }
    }

    private static void AddHoldingPriceFindings(
        IEnumerable<StockTrade> trades,
        ICollection<DataHealthFindingResponse> findings)
    {
        foreach (var trade in trades.Where(item => !item.IsLiquidated && item.PositionQuantity > 0 && item.CurrentPrice <= 0))
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "warning",
                Category = "交易记录",
                BusinessDate = trade.TradeDate.Date,
                Title = "持仓记录缺少收盘价",
                Description = $"{trade.StockName}（{trade.StockCode}）仍有持仓 {trade.PositionQuantity} 股，但收盘价缺失或为 0。",
                StockCode = trade.StockCode,
                StockName = trade.StockName,
                CurrentValue = trade.CurrentPrice,
                ExpectedValue = 0.01m,
                SuggestedAction = "请补齐收盘价，否则持仓盈亏和当日盈亏很难持续校验。"
            });
        }

        foreach (var trade in trades.Where(item => !item.IsLiquidated && item.PositionQuantity > 0 && item.CostPrice <= 0))
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "warning",
                Category = "交易记录",
                BusinessDate = trade.TradeDate.Date,
                Title = "持仓记录缺少成本价",
                Description = $"{trade.StockName}（{trade.StockCode}）仍有持仓 {trade.PositionQuantity} 股，但成本价缺失或为 0。",
                StockCode = trade.StockCode,
                StockName = trade.StockName,
                CurrentValue = trade.CostPrice,
                ExpectedValue = 0.01m,
                SuggestedAction = "请补齐成本价，避免后续持仓收益率和周期统计失真。"
            });
        }
    }

    private static void AddMissingAccountForTradeDayFindings(
        IReadOnlyCollection<AccountDaily> accounts,
        IEnumerable<StockTrade> trades,
        ICollection<DataHealthFindingResponse> findings)
    {
        var accountDates = accounts.Select(item => item.Date.Date).ToHashSet();
        var tradeGroups = trades
            .GroupBy(item => item.TradeDate.Date)
            .Where(group => !accountDates.Contains(group.Key));

        foreach (var group in tradeGroups)
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "warning",
                Category = "账户资金",
                BusinessDate = group.Key,
                Title = "交易日缺少账户快照",
                Description = $"{group.Key:yyyy-MM-dd} 有 {group.Count()} 条交易记录，但没有对应的账户资金记录。",
                CurrentValue = group.Count(),
                SuggestedAction = "建议补录当天总资产、持仓市值和可用资金，方便核对真实收益。"
            });
        }
    }

    private static void AddMissingAccountForBankFlowDayFindings(
        IReadOnlyCollection<AccountDaily> accounts,
        IEnumerable<BankFlow> bankFlows,
        ICollection<DataHealthFindingResponse> findings)
    {
        var accountDates = accounts.Select(item => item.Date.Date).ToHashSet();
        var bankFlowGroups = bankFlows
            .GroupBy(item => item.Date.Date)
            .Where(group => !accountDates.Contains(group.Key));

        foreach (var group in bankFlowGroups)
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "info",
                Category = "银证流水",
                BusinessDate = group.Key,
                Title = "银证转账日缺少账户快照",
                Description = $"{group.Key:yyyy-MM-dd} 有 {group.Count()} 条银证流水，但没有对应的账户资金记录。",
                CurrentValue = group.Count(),
                SuggestedAction = "如果你要回看净入金修正收益率，建议把当天账户快照也补齐。"
            });
        }
    }

    private static void AddAccountTradePnlGapFindings(
        IReadOnlyCollection<AccountDaily> accounts,
        IEnumerable<StockTrade> trades,
        ICollection<DataHealthFindingResponse> findings)
    {
        var latestTradePnLByDate = trades
            .GroupBy(item => new { Date = item.TradeDate.Date, item.StockCode })
            .Select(group => group.OrderBy(item => item.Id).Last())
            .GroupBy(item => item.TradeDate.Date)
            .ToDictionary(
                group => group.Key,
                group => decimal.Round(group.Sum(item => item.DailyPnL), 2, MidpointRounding.AwayFromZero));

        foreach (var account in accounts)
        {
            if (!latestTradePnLByDate.TryGetValue(account.Date.Date, out var tradeDailyPnL))
            {
                continue;
            }

            var difference = decimal.Round(account.DailyPnL - tradeDailyPnL, 2, MidpointRounding.AwayFromZero);
            var absoluteDifference = Math.Abs(difference);
            if (absoluteDifference < 1)
            {
                continue;
            }

            findings.Add(new DataHealthFindingResponse
            {
                Severity = absoluteDifference >= 500 ? "error" : "warning",
                Category = "盈亏核对",
                BusinessDate = account.Date.Date,
                Title = "账户当日盈亏与持仓流水汇总不一致",
                Description = $"{account.Date:yyyy-MM-dd} 的账户当日盈亏为 {account.DailyPnL:F2}，按每只股票最新流水汇总为 {tradeDailyPnL:F2}，相差 {difference:F2}。",
                CurrentValue = account.DailyPnL,
                ExpectedValue = tradeDailyPnL,
                Difference = difference,
                SuggestedAction = "请优先检查当天是否存在重复股票记录、漏录持仓，或 OCR 回填了错误的当日盈亏。"
            });
        }
    }

    private static void AddOrphanNoteFindings(
        IEnumerable<TradeNote> notes,
        IEnumerable<StockTrade> trades,
        ICollection<DataHealthFindingResponse> findings)
    {
        var stockCodes = trades
            .Select(item => item.StockCode)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var note in notes.Where(item => !string.IsNullOrWhiteSpace(item.StockCode) && !stockCodes.Contains(item.StockCode!)))
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "info",
                Category = "笔记",
                BusinessDate = note.Date.Date,
                Title = "笔记关联的股票没有任何历史流水",
                Description = $"股票笔记 {note.StockCode} 在交易库中没有找到对应历史流水。",
                StockCode = note.StockCode,
                SuggestedAction = "如果这是旧代码或手误，可以修改笔记的股票代码，避免后续历史页无法自动关联。"
            });
        }
    }

    private static void AddAuditFindings(
        IEnumerable<PortfolioImportAudit> audits,
        ICollection<DataHealthFindingResponse> findings)
    {
        foreach (var audit in audits.Where(item => !item.ParseSuccess))
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "warning",
                Category = "图片识别",
                BusinessDate = audit.ImportDate?.Date ?? audit.CreatedAt.Date,
                Title = "存在识别失败的截图导入记录",
                Description = $"{audit.SourceFileName} 识别失败：{audit.ParseMessage}",
                SuggestedAction = "可到识别审计页查看原图与错误信息，确认是图片不完整还是 OCR 规则需要继续增强。"
            });
        }

        foreach (var audit in audits.Where(item => item.ParseSuccess && !item.SaveAttempted))
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "info",
                Category = "图片识别",
                BusinessDate = audit.RecognizedDate?.Date ?? audit.ImportDate?.Date ?? audit.CreatedAt.Date,
                Title = "存在尚未入库的识别结果",
                Description = $"{audit.SourceFileName} 已识别出 {audit.PositionCount} 条记录，但还没有保存入库。",
                CurrentValue = audit.PositionCount,
                SuggestedAction = "如果这是有效截图，可到识别审计页回看并决定是否补保存；如果只是试图识别，可忽略。"
            });
        }

        foreach (var audit in audits.Where(item => IsStatus(item.SaveStatus, "partial") || IsStatus(item.SaveStatus, "failed")))
        {
            findings.Add(new DataHealthFindingResponse
            {
                Severity = "warning",
                Category = "图片识别",
                BusinessDate = audit.RecognizedDate?.Date ?? audit.ImportDate?.Date ?? audit.CreatedAt.Date,
                Title = "存在未完整入库的识别结果",
                Description = $"{audit.SourceFileName} 的最终入库状态为 {audit.SaveStatus}，说明识别结果没有完整写入数据库。",
                CurrentValue = audit.SavedTradeCount,
                ExpectedValue = audit.RequestedTradeCount,
                SuggestedAction = "建议到识别审计页查看最终保存结果和错误信息，再决定是否重新识别或手工修正。"
            });
        }
    }

    private static bool IsSeverity(DataHealthFindingResponse finding, string severity) =>
        string.Equals(finding.Severity, severity, StringComparison.OrdinalIgnoreCase);

    private static int GetSeverityRank(string severity)
    {
        if (string.Equals(severity, "error", StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }

        if (string.Equals(severity, "warning", StringComparison.OrdinalIgnoreCase))
        {
            return 1;
        }

        return 2;
    }

    private static bool IsStatus(string? status, string expected) =>
        string.Equals(status, expected, StringComparison.OrdinalIgnoreCase);
}
