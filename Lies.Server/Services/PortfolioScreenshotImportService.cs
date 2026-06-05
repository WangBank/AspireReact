using System.Globalization;
using System.Buffers.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RapidOCRSharpOnnx;
using RapidOCRSharpOnnx.Configurations;
using RapidOCRSharpOnnx.Inference.PPOCR_Det.Models;
using RapidOCRSharpOnnx.Providers;
using RapidOCRSharpOnnx.Utils;

namespace Lies.Server.Services;

public class PortfolioScreenshotImportService : IPortfolioScreenshotImportService
{
    private readonly AppDbContext _db;
    private readonly IStockSearchService _stockSearchService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IWebHostEnvironment _environment;
    private readonly RapidOcrOptions _options;
    private readonly ILogger<PortfolioScreenshotImportService> _logger;
    private static readonly JsonSerializerOptions AuditJsonSerializerOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static readonly Regex NumberRegex = new(@"[-+]?\d[\d,]*(?:\.\d+)?", RegexOptions.Compiled);
    private static readonly string[] NoiseTexts =
    [
        "持仓股",
        "市值",
        "持仓/可用",
        "成本/现价",
        "当日盈亏",
        "隐藏",
        "总资产",
        "总市值",
        "浮动盈亏",
        "当日参考盈亏",
        "人民币账户A股",
        "仓位"
    ];

    private static readonly Dictionary<string, string> DefaultModelUrls = new()
    {
        ["ch_PP-OCRv5_det_mobile.onnx"] = "https://raw.githubusercontent.com/meloht/RapidOCRSharpOnnx/master/RapidOCRSharpOnnx.TestCommon/Models/ch_PP-OCRv5_det_mobile.onnx",
        ["ch_PP-OCRv5_rec_mobile.onnx"] = "https://raw.githubusercontent.com/meloht/RapidOCRSharpOnnx/master/RapidOCRSharpOnnx.TestCommon/Models/ch_PP-OCRv5_rec_mobile.onnx",
        ["ch_PP-LCNet_x0_25_textline_ori_cls_mobile.onnx"] = "https://raw.githubusercontent.com/meloht/RapidOCRSharpOnnx/master/RapidOCRSharpOnnx.TestCommon/Models/ch_PP-LCNet_x0_25_textline_ori_cls_mobile.onnx"
    };

    private static readonly string[] DailyFlowHeaderHints =
    [
        "证券名称",
        "当日盈亏",
        "当日盈亏比",
        "持仓数量",
        "当日买入",
        "当日卖出",
        "买入均价",
        "卖出均价",
        "收盘价"
    ];

    private static readonly string[] MobileHoldingsHeaderHints =
    [
        "市值",
        "盈亏",
        "持仓/可用",
        "成本/现价",
        "当日盈亏"
    ];

    private static readonly string[] AccountHistoryHeaderHints =
    [
        "日期",
        "费用合计",
        "市值",
        "总资产",
        "净流入",
        "账户余额"
    ];

    private static readonly string[] FlowHeaderOrder =
    [
        "证券名称",
        "当日盈亏",
        "当日盈亏比",
        "持仓数量",
        "当日买入",
        "当日卖出",
        "买入均价",
        "卖出均价",
        "收盘价"
    ];

    private static readonly Dictionary<string, string[]> HeaderAliases = new()
    {
        ["证券名称"] = ["证券名称", "证券名", "股票名称", "名称"],
        ["当日盈亏"] = ["当日盈亏", "日盈亏"],
        ["当日盈亏比"] = ["当日盈亏比", "日盈亏比", "盈亏比"],
        ["持仓数量"] = ["持仓数量", "持仓股数", "持仓数", "持仓"],
        ["当日买入"] = ["当日买入", "日买入", "买入数量", "买入"],
        ["当日卖出"] = ["当日卖出", "日卖出", "卖出数量", "卖出"],
        ["买入均价"] = ["买入均价", "买均价"],
        ["卖出均价"] = ["卖出均价", "卖均价"],
        ["收盘价"] = ["收盘价", "收盘"],
        ["盈亏"] = ["盈亏"],
        ["持仓/可用"] = ["持仓/可用", "持仓可用"],
        ["成本/现价"] = ["成本/现价", "成本现价"],
        ["日期"] = ["日期"],
        ["费用合计"] = ["费用合计", "费用"],
        ["市值"] = ["市值"],
        ["总资产"] = ["总资产"],
        ["净流入"] = ["净流入"],
        ["账户余额"] = ["账户余额", "余额"]
    };

    private static readonly Regex[] DatePatterns =
    [
        new Regex(@"(?<!\d)(?<year>(?:19|20)\d{2})\D+(?<month>1[0-2]|0?[1-9])\D+(?<day>3[01]|[12]\d|0?[1-9])(?!\d)", RegexOptions.Compiled),
        new Regex(@"(?<!\d)(?<year>(?:19|20)\d{2})(?<month>1[0-2]|0[1-9])(?<day>3[01]|[12]\d|0[1-9])(?!\d)", RegexOptions.Compiled),
        // 兼容 OCR 把日期和右侧数字连在一起的情况，例如 2026-06-017%
        new Regex(@"(?<!\d)(?<year>(?:19|20)\d{2})\D+(?<month>1[0-2]|0?[1-9])\D+(?<day>3[01]|[12]\d|0?[1-9])", RegexOptions.Compiled),
        new Regex(@"(?<!\d)(?<year>(?:19|20)\d{2})(?<month>1[0-2]|0[1-9])(?<day>3[01]|[12]\d|0[1-9])", RegexOptions.Compiled)
    ];
    private static readonly Regex ThreeDecimalPriceRegex = new(@"\d+\.\d{2,3}", RegexOptions.Compiled);

    public PortfolioScreenshotImportService(
        AppDbContext db,
        IStockSearchService stockSearchService,
        IHttpClientFactory httpClientFactory,
        IWebHostEnvironment environment,
        IOptions<RapidOcrOptions> options,
        ILogger<PortfolioScreenshotImportService> logger)
    {
        _db = db;
        _stockSearchService = stockSearchService;
        _httpClientFactory = httpClientFactory;
        _environment = environment;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<PortfolioScreenshotImportResult> ParseAsync(
        int userId,
        PortfolioScreenshotImportRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Image == null || request.Image.Length == 0)
        {
            return new PortfolioScreenshotImportResult
            {
                Success = false,
                StatusCode = StatusCodes.Status400BadRequest,
                Message = "请上传有效的截图文件"
            };
        }

        var tempFilePath = Path.Combine(
            Path.GetTempPath(),
            $"portfolio-import-{Guid.NewGuid():N}{Path.GetExtension(request.Image.FileName)}");
        var importDate = request.ImportDate?.Date ?? DateTime.SpecifyKind(DateTime.Today, DateTimeKind.Unspecified);
        var audit = new PortfolioImportAudit
        {
            UserId = userId,
            ImportDate = importDate,
            SourceFileName = Path.GetFileName(request.Image.FileName),
            ContentType = string.IsNullOrWhiteSpace(request.Image.ContentType)
                ? "application/octet-stream"
                : request.Image.ContentType,
            FileSize = request.Image.Length
        };

        try
        {
            await SaveToTempFileAsync(request.Image, tempFilePath, cancellationToken);
            var imageMetadata = TryReadImageMetadata(tempFilePath);
            audit.StoredImagePath = await SaveAuditImageCopyAsync(
                tempFilePath,
                request.Image.FileName,
                cancellationToken);

            var modelPaths = await EnsureModelPathsAsync(cancellationToken);
            using var ocr = CreateOcrEngine(modelPaths);
            var ocrResult = ocr.RecognizeText(tempFilePath);
            var tokens = BuildTokens(ocrResult);
            var recognizedText = BuildRecognizedText(tokens);

            if (tokens.Count == 0)
            {
                await TryPersistParseAuditAsync(
                    audit,
                    recognizedText,
                    payload: null,
                    recognizedDate: null,
                    parseSuccess: false,
                    parseMessage: "图片中未识别到有效文字，请换一张更清晰的持仓截图重试",
                    positionCount: 0,
                    warningCount: 0,
                    cancellationToken);

                return new PortfolioScreenshotImportResult
                {
                    Success = false,
                    StatusCode = StatusCodes.Status422UnprocessableEntity,
                    Message = "图片中未识别到有效文字，请换一张更清晰的持仓截图重试"
                };
            }

            var warnings = new List<string>();
            var compositeImport = await TryParseCompositeScreenshotAsync(userId, tokens, importDate, warnings, cancellationToken);
            PortfolioAccountImportResponse? account;
            PortfolioBankFlowImportResponse? bankFlow;
            List<PortfolioPositionImportResponse> positions;
            DateTime? recognizedDate;

            if (compositeImport != null)
            {
                account = compositeImport.Account;
                bankFlow = compositeImport.BankFlow;
                positions = compositeImport.Positions;
                recognizedDate = compositeImport.RecognizedDate;
            }
            else
            {
                var isDailyFlowScreenshot = IsDailyFlowScreenshot(tokens);
                var isMobileHoldingsScreenshot = IsMobileHoldingsScreenshot(tokens, imageMetadata);
                account = isDailyFlowScreenshot
                    ? null
                    : ParseAccount(tokens, warnings, warnIfMissing: true);
                bankFlow = null;
                if (isDailyFlowScreenshot)
                {
                    positions = await ParseDailyFlowPositionsAsync(tokens, userId, importDate, warnings, cancellationToken);
                }
                else if (isMobileHoldingsScreenshot)
                {
                    positions = await ParseMobileHoldingsPositionsAsync(tokens, warnings, cancellationToken, warnIfEmpty: false);
                    if (positions.Count == 0)
                    {
                        positions = await ParsePositionsAsync(tokens, warnings, cancellationToken);
                    }
                }
                else
                {
                    positions = await ParsePositionsAsync(tokens, warnings, cancellationToken);
                }

                recognizedDate = null;
            }

            var response = new PortfolioScreenshotImportResponse
            {
                RecognizedDate = recognizedDate,
                Account = account,
                BankFlow = bankFlow,
                Positions = positions,
                Warnings = warnings.Distinct().ToList()
            };
            var parseMessage = $"识别完成：账户字段 {(account == null ? 0 : 4)} 项，股票记录 {positions.Count} 条";
            response.AuditId = await TryPersistParseAuditAsync(
                audit,
                recognizedText,
                response,
                recognizedDate,
                parseSuccess: true,
                parseMessage,
                positionCount: positions.Count,
                warningCount: response.Warnings.Count,
                cancellationToken);

            return new PortfolioScreenshotImportResult
            {
                Success = true,
                Message = parseMessage,
                Data = response
            };
        }
        catch (Exception ex) when (IsNativeRuntimeException(ex))
        {
            _logger.LogError(ex, "RapidOCR 原生依赖加载失败");
            await TryPersistParseAuditAsync(
                audit,
                recognizedText: null,
                payload: null,
                recognizedDate: null,
                parseSuccess: false,
                parseMessage: "RapidOCR 本地依赖加载失败，请确认 ONNX Runtime 与 OpenCvSharp 原生运行时已正确安装",
                positionCount: 0,
                warningCount: 0,
                cancellationToken);
            return new PortfolioScreenshotImportResult
            {
                Success = false,
                StatusCode = StatusCodes.Status503ServiceUnavailable,
                Message = "RapidOCR 本地依赖加载失败，请确认 ONNX Runtime 与 OpenCvSharp 原生运行时已正确安装"
            };
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("RapidOCR 缺少可用字体文件", StringComparison.Ordinal))
        {
            _logger.LogError(ex, "RapidOCR 字体初始化失败");
            await TryPersistParseAuditAsync(
                audit,
                recognizedText: null,
                payload: null,
                recognizedDate: null,
                parseSuccess: false,
                parseMessage: ex.Message,
                positionCount: 0,
                warningCount: 0,
                cancellationToken);
            return new PortfolioScreenshotImportResult
            {
                Success = false,
                StatusCode = StatusCodes.Status503ServiceUnavailable,
                Message = ex.Message
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "解析券商持仓截图失败");
            await TryPersistParseAuditAsync(
                audit,
                recognizedText: null,
                payload: null,
                recognizedDate: null,
                parseSuccess: false,
                parseMessage: $"截图识别失败：{ex.Message}",
                positionCount: 0,
                warningCount: 0,
                cancellationToken);
            return new PortfolioScreenshotImportResult
            {
                Success = false,
                StatusCode = StatusCodes.Status502BadGateway,
                Message = $"截图识别失败：{ex.Message}"
            };
        }
        finally
        {
            TryDeleteFile(tempFilePath);
        }
    }

    public async Task<PagedResult<PortfolioImportAuditListItemResponse>> GetAuditPageAsync(
        int page,
        int pageSize,
        string? saveStatus,
        CancellationToken cancellationToken = default)
    {
        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 100);
        var normalizedStatus = saveStatus?.Trim().ToLowerInvariant();

        var query = _db.PortfolioImportAudits
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(normalizedStatus) && normalizedStatus != "all")
        {
            query = normalizedStatus switch
            {
                "pending" => query.Where(item => item.ParseSuccess && !item.SaveAttempted),
                "success" => query.Where(item => item.SaveAttempted && item.SaveStatus == "success"),
                "partial" => query.Where(item => item.SaveAttempted && item.SaveStatus == "partial"),
                "failed" => query.Where(item => item.SaveAttempted && item.SaveStatus == "failed"),
                "parse-failed" => query.Where(item => !item.ParseSuccess),
                _ => query
            };
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(item => item.CreatedAt)
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<PortfolioImportAuditListItemResponse>
        {
            Items = items.Select(MapAuditListItem).ToList(),
            Total = total,
            Page = normalizedPage,
            PageSize = normalizedPageSize
        };
    }

    public async Task<PortfolioImportAuditDetailResponse?> GetAuditDetailAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var audit = await _db.PortfolioImportAudits
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (audit == null)
        {
            return null;
        }

        var recognizedPayload = DeserializeJson<PortfolioScreenshotImportResponse>(audit.RecognizedPayloadJson);
        if (recognizedPayload != null)
        {
            recognizedPayload.AuditId = audit.Id;
        }

        return new PortfolioImportAuditDetailResponse
        {
            Id = audit.Id,
            CreatedAt = audit.CreatedAt,
            ImportDate = audit.ImportDate,
            RecognizedDate = audit.RecognizedDate,
            SourceFileName = audit.SourceFileName,
            ContentType = audit.ContentType,
            FileSize = audit.FileSize,
            ParseSuccess = audit.ParseSuccess,
            ParseMessage = audit.ParseMessage,
            PositionCount = audit.PositionCount,
            WarningCount = audit.WarningCount,
            SaveAttempted = audit.SaveAttempted,
            SaveStatus = audit.SaveStatus,
            SavedAccount = audit.SavedAccount,
            SavedBankFlow = audit.SavedBankFlow,
            SavedTrades = audit.SavedTrades,
            RequestedTradeCount = audit.RequestedTradeCount,
            SavedTradeCount = audit.SavedTradeCount,
            SaveMessage = audit.SaveMessage,
            HasImage = HasStoredImage(audit.StoredImagePath),
            RecognizedText = audit.RecognizedText,
            RecognizedPayload = recognizedPayload,
            FinalPayload = DeserializeJson<PortfolioImportAuditFinalPayload>(audit.FinalPayloadJson),
            SaveResult = BuildSaveResult(audit)
        };
    }

    public async Task<(byte[] Bytes, string ContentType, string FileName)?> GetAuditImageAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var audit = await _db.PortfolioImportAudits
            .AsNoTracking()
            .Select(item => new
            {
                item.Id,
                item.StoredImagePath,
                item.ContentType,
                item.SourceFileName
            })
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (audit == null || !HasStoredImage(audit.StoredImagePath))
        {
            return null;
        }

        var bytes = await File.ReadAllBytesAsync(audit.StoredImagePath!, cancellationToken);
        return (
            bytes,
            string.IsNullOrWhiteSpace(audit.ContentType) ? "application/octet-stream" : audit.ContentType,
            string.IsNullOrWhiteSpace(audit.SourceFileName)
                ? Path.GetFileName(audit.StoredImagePath!)
                : audit.SourceFileName);
    }

    public async Task<bool> FinalizeAuditAsync(
        int currentUserId,
        bool isAdmin,
        int id,
        PortfolioImportAuditFinalizeRequest request,
        CancellationToken cancellationToken = default)
    {
        var audit = await _db.PortfolioImportAudits.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (audit == null)
        {
            return false;
        }

        if (!isAdmin && audit.UserId != currentUserId)
        {
            throw new UnauthorizedAccessException("无权回填其他用户的识别审计记录。");
        }

        var finalPayload = new PortfolioImportAuditFinalPayload
        {
            FinalAccount = request.FinalAccount,
            FinalBankFlow = request.FinalBankFlow,
            FinalTrades = request.FinalTrades ?? []
        };
        var saveErrors = (request.SaveErrors ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct()
            .ToList();

        audit.SaveAttempted = true;
        audit.SaveCompletedAt = DateTime.UtcNow;
        audit.SavedAccount = request.SavedAccount;
        audit.SavedBankFlow = request.SavedBankFlow;
        audit.SavedTrades = request.SavedTrades;
        audit.RequestedTradeCount = request.RequestedTradeCount > 0
            ? request.RequestedTradeCount
            : finalPayload.FinalTrades.Count;
        audit.SavedTradeCount = Math.Max(0, request.SavedTradeCount);
        audit.FinalPayloadJson = SerializeJson(finalPayload);
        audit.SaveErrorsJson = SerializeJson(saveErrors);
        audit.SaveStatus = ResolveSaveStatus(request, finalPayload);
        audit.SaveMessage = string.IsNullOrWhiteSpace(request.SaveMessage)
            ? GetDefaultSaveMessage(audit.SaveStatus)
            : request.SaveMessage;

        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task SaveToTempFileAsync(IFormFile file, string tempFilePath, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        await using var output = File.Create(tempFilePath);
        await stream.CopyToAsync(output, cancellationToken);
    }

    private async Task<string?> SaveAuditImageCopyAsync(
        string tempFilePath,
        string sourceFileName,
        CancellationToken cancellationToken)
    {
        if (!File.Exists(tempFilePath))
        {
            return null;
        }

        var extension = Path.GetExtension(sourceFileName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".png";
        }

        var auditDirectory = Path.Combine(
            _environment.ContentRootPath,
            "RuntimeData",
            "PortfolioImportAudits",
            DateTime.Today.ToString("yyyyMMdd"));
        Directory.CreateDirectory(auditDirectory);

        var targetPath = Path.Combine(
            auditDirectory,
            $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension.ToLowerInvariant()}");

        await using var sourceStream = File.OpenRead(tempFilePath);
        await using var targetStream = File.Create(targetPath);
        await sourceStream.CopyToAsync(targetStream, cancellationToken);

        return targetPath;
    }

    private async Task<int> TryPersistParseAuditAsync(
        PortfolioImportAudit audit,
        string? recognizedText,
        PortfolioScreenshotImportResponse? payload,
        DateTime? recognizedDate,
        bool parseSuccess,
        string parseMessage,
        int positionCount,
        int warningCount,
        CancellationToken cancellationToken)
    {
        try
        {
            audit.ParseSuccess = parseSuccess;
            audit.ParseMessage = parseMessage;
            audit.PositionCount = positionCount;
            audit.WarningCount = warningCount;
            audit.RecognizedDate = recognizedDate?.Date;
            audit.RecognizedText = string.IsNullOrWhiteSpace(recognizedText) ? null : recognizedText;
            audit.RecognizedPayloadJson = payload == null ? null : SerializeJson(payload);

            _db.PortfolioImportAudits.Add(audit);
            await _db.SaveChangesAsync(cancellationToken);
            return audit.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "写入图片识别审计记录失败");
            return 0;
        }
    }

    private static string BuildRecognizedText(IReadOnlyCollection<OcrToken> tokens)
    {
        if (tokens.Count == 0)
        {
            return string.Empty;
        }

        var orderedTokens = tokens
            .OrderBy(item => item.CenterY)
            .ThenBy(item => item.XMin)
            .ToList();
        var averageHeight = orderedTokens.Average(item => Math.Max(1f, item.YMax - item.YMin));
        var tolerance = Math.Max(8f, averageHeight * 0.8f);
        var lines = GroupLines(orderedTokens, tolerance);

        return string.Join(
            Environment.NewLine,
            lines.Select(line => string.Join(" ", line.Select(item => item.Text)).Trim())
                .Where(line => !string.IsNullOrWhiteSpace(line)));
    }

    private static PortfolioImportAuditListItemResponse MapAuditListItem(PortfolioImportAudit audit) =>
        new()
        {
            Id = audit.Id,
            CreatedAt = audit.CreatedAt,
            ImportDate = audit.ImportDate,
            RecognizedDate = audit.RecognizedDate,
            SourceFileName = audit.SourceFileName,
            ContentType = audit.ContentType,
            FileSize = audit.FileSize,
            ParseSuccess = audit.ParseSuccess,
            ParseMessage = audit.ParseMessage,
            PositionCount = audit.PositionCount,
            WarningCount = audit.WarningCount,
            SaveAttempted = audit.SaveAttempted,
            SaveStatus = audit.SaveStatus,
            SavedAccount = audit.SavedAccount,
            SavedBankFlow = audit.SavedBankFlow,
            SavedTrades = audit.SavedTrades,
            RequestedTradeCount = audit.RequestedTradeCount,
            SavedTradeCount = audit.SavedTradeCount,
            SaveMessage = audit.SaveMessage
        };

    private static PortfolioImportAuditSaveResult? BuildSaveResult(PortfolioImportAudit audit)
    {
        if (!audit.SaveAttempted
            && string.IsNullOrWhiteSpace(audit.SaveStatus)
            && string.IsNullOrWhiteSpace(audit.SaveMessage)
            && string.IsNullOrWhiteSpace(audit.SaveErrorsJson))
        {
            return null;
        }

        return new PortfolioImportAuditSaveResult
        {
            SaveSucceeded = string.Equals(audit.SaveStatus, "success", StringComparison.OrdinalIgnoreCase),
            SavedAccount = audit.SavedAccount,
            SavedBankFlow = audit.SavedBankFlow,
            SavedTrades = audit.SavedTrades,
            RequestedTradeCount = audit.RequestedTradeCount,
            SavedTradeCount = audit.SavedTradeCount,
            SaveStatus = audit.SaveStatus,
            SaveMessage = audit.SaveMessage,
            SaveErrors = DeserializeJson<List<string>>(audit.SaveErrorsJson) ?? [],
            SaveCompletedAt = audit.SaveCompletedAt
        };
    }

    private static string ResolveSaveStatus(
        PortfolioImportAuditFinalizeRequest request,
        PortfolioImportAuditFinalPayload finalPayload)
    {
        if (request.SaveSucceeded)
        {
            return "success";
        }

        var expectedSections = 0;
        var savedSections = 0;

        if (finalPayload.FinalAccount != null)
        {
            expectedSections++;
            if (request.SavedAccount)
            {
                savedSections++;
            }
        }

        if (finalPayload.FinalBankFlow != null)
        {
            expectedSections++;
            if (request.SavedBankFlow)
            {
                savedSections++;
            }
        }

        if (finalPayload.FinalTrades.Count > 0 || request.RequestedTradeCount > 0)
        {
            expectedSections++;
            if (request.SavedTrades || request.SavedTradeCount > 0)
            {
                savedSections++;
            }
        }

        if (savedSections > 0 || request.SavedTradeCount > 0)
        {
            return "partial";
        }

        return "failed";
    }

    private static string GetDefaultSaveMessage(string? saveStatus) => saveStatus switch
    {
        "success" => "识别结果已完整入库",
        "partial" => "识别结果仅部分入库，请结合错误信息复核",
        _ => "识别结果未成功入库"
    };

    private static bool HasStoredImage(string? storedImagePath) =>
        !string.IsNullOrWhiteSpace(storedImagePath) && File.Exists(storedImagePath);

    private static string? SerializeJson<T>(T value)
    {
        if (value == null)
        {
            return null;
        }

        return JsonSerializer.Serialize(value, AuditJsonSerializerOptions);
    }

    private static T? DeserializeJson<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(json, AuditJsonSerializerOptions);
        }
        catch
        {
            return default;
        }
    }

    private async Task<(string DetectorPath, string RecognizerPath, string ClassifierPath)> EnsureModelPathsAsync(CancellationToken cancellationToken)
    {
        var detectorPath = ResolveConfiguredPath(_options.DetectorModelPath);
        var recognizerPath = ResolveConfiguredPath(_options.RecognizerModelPath);
        var classifierPath = ResolveConfiguredPath(_options.ClassifierModelPath);

        if (File.Exists(detectorPath) && File.Exists(recognizerPath) && File.Exists(classifierPath))
        {
            return (detectorPath, recognizerPath, classifierPath);
        }

        if (!_options.AutoDownloadModels)
        {
            throw new FileNotFoundException("RapidOCR 模型文件不存在，且当前已关闭自动下载");
        }

        var modelDirectory = ResolveModelsDirectory();
        Directory.CreateDirectory(modelDirectory);
        var httpClient = _httpClientFactory.CreateClient("RapidOcrModels");

        detectorPath = await EnsureModelFileAsync(httpClient, modelDirectory, "ch_PP-OCRv5_det_mobile.onnx", detectorPath, cancellationToken);
        recognizerPath = await EnsureModelFileAsync(httpClient, modelDirectory, "ch_PP-OCRv5_rec_mobile.onnx", recognizerPath, cancellationToken);
        classifierPath = await EnsureModelFileAsync(httpClient, modelDirectory, "ch_PP-LCNet_x0_25_textline_ori_cls_mobile.onnx", classifierPath, cancellationToken);

        return (detectorPath, recognizerPath, classifierPath);
    }

    private string ResolveConfiguredPath(string configuredPath)
    {
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            return string.Empty;
        }

        return Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(_environment.ContentRootPath, configuredPath);
    }

    private string ResolveModelsDirectory()
    {
        return Path.IsPathRooted(_options.ModelsDirectory)
            ? _options.ModelsDirectory
            : Path.Combine(_environment.ContentRootPath, _options.ModelsDirectory);
    }

    private async Task<string> EnsureModelFileAsync(
        HttpClient httpClient,
        string modelDirectory,
        string fileName,
        string configuredPath,
        CancellationToken cancellationToken)
    {
        var targetPath = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(modelDirectory, fileName)
            : configuredPath;

        if (File.Exists(targetPath))
        {
            return targetPath;
        }

        if (!DefaultModelUrls.TryGetValue(fileName, out var url))
        {
            throw new FileNotFoundException($"缺少模型下载地址：{fileName}");
        }

        _logger.LogInformation("开始下载 RapidOCR 模型 {FileName}", fileName);
        await using var networkStream = await httpClient.GetStreamAsync(url, cancellationToken);
        await using var output = File.Create(targetPath);
        await networkStream.CopyToAsync(output, cancellationToken);
        _logger.LogInformation("RapidOCR 模型下载完成 {FileName}", fileName);
        return targetPath;
    }

    private RapidOCRSharp CreateOcrEngine((string DetectorPath, string RecognizerPath, string ClassifierPath) modelPaths)
    {
        var fontPath = ResolveFontPath();
        if (string.IsNullOrWhiteSpace(fontPath))
        {
            throw new InvalidOperationException(
                "RapidOCR 缺少可用字体文件。请在运行环境中安装中文字体，或通过 RapidOcr:FontPath 指定一个可读的 .ttf/.ttc 字体文件。Docker 镜像建议安装 fonts-noto-cjk。");
        }

        var config = new OcrConfig(
            modelPaths.DetectorPath,
            modelPaths.RecognizerPath,
            fontPath,
            OCRVersion.PPOCRV5,
            modelPaths.ClassifierPath);

        return new RapidOCRSharp(new ExecutionProviderCPU(config));
    }

    private static bool IsNativeRuntimeException(Exception exception)
    {
        return exception is DllNotFoundException
            || exception is EntryPointNotFoundException
            || exception is TypeInitializationException
            || exception.InnerException is DllNotFoundException
            || exception.InnerException is EntryPointNotFoundException;
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // 忽略临时文件清理失败
        }
    }

    private string? ResolveFontPath()
    {
        var configuredFontPath = ResolveConfiguredPath(_options.FontPath);
        if (!string.IsNullOrWhiteSpace(configuredFontPath) && File.Exists(configuredFontPath))
        {
            return configuredFontPath;
        }

        var candidates = new[]
        {
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "/System/Library/Fonts/STHeiti Medium.ttc",
            @"C:\Windows\Fonts\msyh.ttc",
            @"C:\Windows\Fonts\msyh.ttf",
            @"C:\Windows\Fonts\simhei.ttf",
            @"C:\Windows\Fonts\simsun.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
        };

        return candidates.FirstOrDefault(File.Exists);
    }

    private static List<OcrToken> BuildTokens(OcrResult ocrResult)
    {
        var items = ocrResult.DetResult?.Data?.DetItems ?? [];
        return items
            .Where(item => !string.IsNullOrWhiteSpace(item.Word) && item.Box?.Length > 0)
            .Select(item =>
            {
                var xValues = item.Box.Select(point => point.X).ToArray();
                var yValues = item.Box.Select(point => point.Y).ToArray();
                return new OcrToken
                {
                    Text = item.Word.Trim(),
                    Score = item.Score,
                    XMin = xValues.Min(),
                    XMax = xValues.Max(),
                    YMin = yValues.Min(),
                    YMax = yValues.Max()
                };
            })
            .OrderBy(token => token.CenterY)
            .ThenBy(token => token.XMin)
            .ToList();
    }

    private static PortfolioAccountImportResponse? ParseAccount(
        List<OcrToken> tokens,
        List<string> warnings,
        bool warnIfMissing)
    {
        var totalAssets = FindValueBelow(tokens, ["总资产"]);
        var positionValue = FindValueBelow(tokens, ["股票市值", "持仓市值", "总市值"]);
        var availableFunds = FindValueBelow(tokens, ["可用金额", "可用资金", "可用"]);
        var dailyPnL = FindValueBelow(tokens, ["当日参考盈亏", "当日盈亏"]);

        if (totalAssets == null && positionValue == null && availableFunds == null && dailyPnL == null)
        {
            if (warnIfMissing)
            {
                warnings.Add("未识别到账户汇总数据，请确认截图中包含总资产和当日盈亏区域。");
            }

            return null;
        }

        if (totalAssets == null) warnings.Add("未识别到总资产，已按 0 处理。");
        if (positionValue == null) warnings.Add("未识别到持仓市值，已按 0 处理。");
        if (availableFunds == null) warnings.Add("未识别到可用资金，已按 0 处理。");
        if (dailyPnL == null) warnings.Add("未识别到当日盈亏，已按 0 处理。");

        return new PortfolioAccountImportResponse
        {
            TotalAssets = totalAssets ?? 0,
            PositionValue = positionValue ?? 0,
            AvailableFunds = availableFunds ?? 0,
            DailyPnL = dailyPnL ?? 0
        };
    }

    private static ImageSnapshotMetadata? TryReadImageMetadata(string filePath)
    {
        try
        {
            using var stream = File.OpenRead(filePath);
            Span<byte> header = stackalloc byte[64];
            var bytesRead = stream.Read(header);
            if (bytesRead <= 0)
            {
                return null;
            }

            var headerSpan = header[..bytesRead];
            if (TryReadPngMetadata(headerSpan, out var pngMetadata))
            {
                return pngMetadata;
            }

            if (TryReadWebpMetadata(headerSpan, out var webpMetadata))
            {
                return webpMetadata;
            }

            stream.Position = 0;
            return TryReadJpegMetadata(stream, out var jpegMetadata)
                ? jpegMetadata
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static bool TryReadPngMetadata(ReadOnlySpan<byte> header, out ImageSnapshotMetadata metadata)
    {
        metadata = default!;
        ReadOnlySpan<byte> pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
        if (header.Length < 24 || !header[..8].SequenceEqual(pngSignature))
        {
            return false;
        }

        var width = (int)BinaryPrimitives.ReadUInt32BigEndian(header.Slice(16, 4));
        var height = (int)BinaryPrimitives.ReadUInt32BigEndian(header.Slice(20, 4));
        return TryCreateImageSnapshotMetadata(width, height, out metadata);
    }

    private static bool TryReadWebpMetadata(ReadOnlySpan<byte> header, out ImageSnapshotMetadata metadata)
    {
        metadata = default!;
        ReadOnlySpan<byte> riffHeader = "RIFF"u8;
        ReadOnlySpan<byte> webpHeader = "WEBP"u8;
        if (header.Length < 30
            || !header[..4].SequenceEqual(riffHeader)
            || !header.Slice(8, 4).SequenceEqual(webpHeader))
        {
            return false;
        }

        var chunkType = header.Slice(12, 4);
        int width;
        int height;

        if (chunkType.SequenceEqual("VP8X"u8))
        {
            width = 1 + header[24] + (header[25] << 8) + (header[26] << 16);
            height = 1 + header[27] + (header[28] << 8) + (header[29] << 16);
            return TryCreateImageSnapshotMetadata(width, height, out metadata);
        }

        if (chunkType.SequenceEqual("VP8L"u8) && header.Length >= 25 && header[20] == 0x2F)
        {
            width = 1 + (((header[22] & 0x3F) << 8) | header[21]);
            height = 1 + (((header[24] & 0x0F) << 10) | (header[23] << 2) | ((header[22] & 0xC0) >> 6));
            return TryCreateImageSnapshotMetadata(width, height, out metadata);
        }

        if (chunkType.SequenceEqual("VP8 "u8)
            && header.Length >= 30
            && header[23] == 0x9D
            && header[24] == 0x01
            && header[25] == 0x2A)
        {
            width = BinaryPrimitives.ReadUInt16LittleEndian(header.Slice(26, 2)) & 0x3FFF;
            height = BinaryPrimitives.ReadUInt16LittleEndian(header.Slice(28, 2)) & 0x3FFF;
            return TryCreateImageSnapshotMetadata(width, height, out metadata);
        }

        return false;
    }

    private static bool TryReadJpegMetadata(Stream stream, out ImageSnapshotMetadata metadata)
    {
        metadata = default!;
        Span<byte> markerBuffer = stackalloc byte[2];
        if (stream.Read(markerBuffer) != 2 || markerBuffer[0] != 0xFF || markerBuffer[1] != 0xD8)
        {
            return false;
        }

        while (TryReadNextJpegMarker(stream, out var marker))
        {
            if (marker == 0xD9 || marker == 0xDA)
            {
                break;
            }

            if (marker is >= 0xD0 and <= 0xD7 or 0x01)
            {
                continue;
            }

            if (!TryReadBigEndianUInt16(stream, out var segmentLength) || segmentLength < 2)
            {
                return false;
            }

            if (IsJpegStartOfFrameMarker(marker))
            {
                Span<byte> sofHeader = stackalloc byte[5];
                if (stream.Read(sofHeader) != sofHeader.Length)
                {
                    return false;
                }

                var height = BinaryPrimitives.ReadUInt16BigEndian(sofHeader.Slice(1, 2));
                var width = BinaryPrimitives.ReadUInt16BigEndian(sofHeader.Slice(3, 2));
                return TryCreateImageSnapshotMetadata(width, height, out metadata);
            }

            stream.Seek(segmentLength - 2, SeekOrigin.Current);
        }

        return false;
    }

    private static bool TryReadNextJpegMarker(Stream stream, out byte marker)
    {
        marker = 0;
        int currentByte;

        do
        {
            currentByte = stream.ReadByte();
        } while (currentByte != -1 && currentByte != 0xFF);

        if (currentByte == -1)
        {
            return false;
        }

        do
        {
            currentByte = stream.ReadByte();
        } while (currentByte == 0xFF);

        if (currentByte <= 0)
        {
            return false;
        }

        marker = (byte)currentByte;
        return true;
    }

    private static bool TryReadBigEndianUInt16(Stream stream, out ushort value)
    {
        value = 0;
        Span<byte> buffer = stackalloc byte[2];
        if (stream.Read(buffer) != buffer.Length)
        {
            return false;
        }

        value = BinaryPrimitives.ReadUInt16BigEndian(buffer);
        return true;
    }

    private static bool IsJpegStartOfFrameMarker(byte marker)
    {
        return marker is 0xC0 or 0xC1 or 0xC2 or 0xC3 or 0xC5 or 0xC6 or 0xC7 or 0xC9 or 0xCA or 0xCB or 0xCD or 0xCE or 0xCF;
    }

    private static bool TryCreateImageSnapshotMetadata(int width, int height, out ImageSnapshotMetadata metadata)
    {
        metadata = default!;
        if (width <= 0 || height <= 0)
        {
            return false;
        }

        metadata = new ImageSnapshotMetadata
        {
            Width = width,
            Height = height
        };
        return true;
    }

    private static bool IsDailyFlowScreenshot(List<OcrToken> tokens)
    {
        var joined = NormalizeFlowHeaderText(string.Concat(tokens.Select(token => token.Text)));
        return DailyFlowHeaderHints.Count(header => joined.Contains(NormalizeFlowHeaderText(header), StringComparison.OrdinalIgnoreCase)) >= 4;
    }

    private static bool IsMobileHoldingsScreenshot(List<OcrToken> tokens, ImageSnapshotMetadata? metadata)
    {
        if (tokens.Count == 0 || metadata == null)
        {
            return false;
        }

        if (metadata.AspectRatio <= 0
            || metadata.AspectRatio > 0.62f
            || metadata.Height < metadata.Width * 1.55f)
        {
            return false;
        }

        var joined = NormalizeFlowHeaderText(string.Concat(tokens.Select(token => token.Text)));
        var hitCount = MobileHoldingsHeaderHints.Count(header =>
            joined.Contains(NormalizeFlowHeaderText(header), StringComparison.OrdinalIgnoreCase));

        return hitCount >= 4;
    }

    private static decimal? FindValueBelow(List<OcrToken> tokens, string[] labels)
    {
        var labelToken = tokens.FirstOrDefault(token =>
            labels.Any(label => token.Text.Contains(label, StringComparison.OrdinalIgnoreCase)));
        if (labelToken == null)
        {
            return null;
        }

        var labelLine = tokens
            .Where(token => Math.Abs(token.CenterY - labelToken.CenterY) <= 28)
            .OrderBy(token => token.XMin)
            .ToList();

        var labelIndex = labelLine.FindIndex(token => ReferenceEquals(token, labelToken));
        var leftBoundary = labelIndex > 0
            ? (labelLine[labelIndex - 1].XMax + labelToken.XMin) / 2
            : labelToken.XMin - 40;
        var rightBoundary = labelIndex >= 0 && labelIndex < labelLine.Count - 1
            ? (labelToken.XMax + labelLine[labelIndex + 1].XMin) / 2
            : labelToken.XMax + 260;

        var candidates = tokens
            .Where(token =>
                token.YMin >= labelToken.YMax
                && token.YMin - labelToken.YMax <= 160
                && token.CenterX >= leftBoundary - 24
                && token.CenterX <= rightBoundary + 24
                && TryParseNumber(token.Text, out _))
            .OrderBy(token => token.YMin - labelToken.YMax)
            .ThenBy(token => Math.Abs(token.CenterX - labelToken.CenterX))
            .ToList();

        foreach (var candidate in candidates)
        {
            if (TryParseNumber(candidate.Text, out var value))
            {
                return value;
            }
        }

        return null;
    }

    private async Task<CompositeImportParseResult?> TryParseCompositeScreenshotAsync(
        int userId,
        List<OcrToken> tokens,
        DateTime importDate,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        if (!TrySplitCompositeScreenshot(tokens, out var leftTokens, out var rightTokens))
        {
            return null;
        }

        var accountRows = ParseAccountHistoryRows(leftTokens, warnings);
        var detailDate = ResolveCompositeDetailDate(rightTokens, accountRows, importDate, warnings);
        var accountRow = SelectAccountHistoryRow(accountRows, detailDate, warnings);
        var positions = await ParseDailyFlowPositionsAsync(rightTokens, userId, detailDate, warnings, cancellationToken);
        var dailyPnL = ResolveDailyFlowDailyPnL(positions, rightTokens, warnings);

        if (accountRow == null && positions.Count == 0)
        {
            return null;
        }

        return new CompositeImportParseResult
        {
            Account = accountRow == null
                ? null
                : new PortfolioAccountImportResponse
                {
                    TotalAssets = accountRow.TotalAssets,
                    PositionValue = accountRow.PositionValue,
                    AvailableFunds = accountRow.AvailableFunds,
                    DailyPnL = dailyPnL
                },
            BankFlow = accountRow != null && Math.Abs(accountRow.NetInflow) > 0.009m
                ? new PortfolioBankFlowImportResponse
                {
                    Date = detailDate,
                    FlowType = accountRow.NetInflow >= 0 ? "转入" : "转出",
                    Amount = Math.Abs(accountRow.NetInflow),
                    Remark = "图片识别导入"
                }
                : null,
            RecognizedDate = detailDate,
            Positions = positions
        };
    }

    private static bool TrySplitCompositeScreenshot(
        List<OcrToken> tokens,
        out List<OcrToken> leftTokens,
        out List<OcrToken> rightTokens)
    {
        leftTokens = [];
        rightTokens = [];

        var lines = GroupLines(tokens, 26f);
        var flowHeaderLine = lines.FirstOrDefault(IsDailyFlowHeaderLine);
        if (flowHeaderLine == null)
        {
            return false;
        }

        var stockHeaderCenter = FindHeaderCenter(flowHeaderLine, "证券名称");
        if (stockHeaderCenter == null)
        {
            return false;
        }

        var splitX = stockHeaderCenter.Value - 120f;
        if (splitX <= 0)
        {
            return false;
        }

        leftTokens = tokens.Where(token => token.CenterX < splitX).ToList();
        rightTokens = tokens.Where(token => token.CenterX >= splitX).ToList();

        if (leftTokens.Count == 0 || rightTokens.Count == 0)
        {
            return false;
        }

        return GroupLines(rightTokens, 26f).Any(IsDailyFlowHeaderLine);
    }

    private static List<AccountHistoryRow> ParseAccountHistoryRows(
        List<OcrToken> tokens,
        List<string> warnings)
    {
        var lines = GroupLines(tokens, 26f);
        var headerIndex = lines.FindIndex(IsAccountHistoryHeaderLine);
        if (headerIndex < 0)
        {
            return [];
        }

        if (!TryBuildAccountHistoryLayout(lines[headerIndex], out var layout))
        {
            warnings.Add("账户汇总列表列位置识别失败，请确认截图左侧包含日期、总资产和账户余额列。");
            return [];
        }

        var rows = new List<AccountHistoryRow>();
        for (var i = headerIndex + 1; i < lines.Count; i++)
        {
            var line = lines[i];
            if (line.Count == 0 || IsAccountHistoryHeaderLine(line))
            {
                continue;
            }

            var dateText = JoinTokensInRange(line, null, layout.DateRightBoundary);
            if (!TryParseDateText(dateText, out var rowDate))
            {
                continue;
            }

            var numericValues = line
                .Where(token => token.CenterX >= layout.DateRightBoundary && TryParseNumber(token.Text, out _))
                .OrderBy(token => token.XMin)
                .Select(token => ParseNumberOrZero(token.Text))
                .ToList();

            if (numericValues.Count < 4)
            {
                continue;
            }

            var row = new AccountHistoryRow
            {
                Date = rowDate.Date,
                PositionValue = numericValues[^4],
                TotalAssets = numericValues[^3],
                NetInflow = numericValues[^2],
                AvailableFunds = numericValues[^1]
            };

            if (row.PositionValue == 0 && row.TotalAssets == 0 && row.NetInflow == 0 && row.AvailableFunds == 0)
            {
                continue;
            }

            rows.Add(row);
        }

        if (rows.Count == 0)
        {
            warnings.Add("未识别到账户汇总列表中的有效日期行。");
            return [];
        }

        return rows;
    }

    private static AccountHistoryRow? SelectAccountHistoryRow(
        List<AccountHistoryRow> rows,
        DateTime importDate,
        List<string> warnings)
    {
        if (rows.Count == 0)
        {
            return null;
        }

        var selectedRow = rows.FirstOrDefault(row => row.Date == importDate.Date) ?? rows[0];
        if (selectedRow.Date != importDate.Date)
        {
            warnings.Add($"左侧账户汇总列表中未找到 {importDate:yyyy-MM-dd}，已改用 {selectedRow.Date:yyyy-MM-dd} 的数据。");
        }

        return selectedRow;
    }

    private static DateTime ResolveCompositeDetailDate(
        List<OcrToken> rightTokens,
        List<AccountHistoryRow> accountRows,
        DateTime importDate,
        List<string> warnings)
    {
        var visibleDates = accountRows
            .Select(row => row.Date.Date)
            .Distinct()
            .OrderBy(date => date)
            .ToList();
        var detailDateCandidate = FindSelectedDetailDateCandidate(rightTokens);
        if (detailDateCandidate != null
            && TryMatchVisibleDateFromRawText(detailDateCandidate.RawText, visibleDates, importDate, out var correctedVisibleDate))
        {
            if (detailDateCandidate.Date.HasValue && detailDateCandidate.Date.Value.Date != correctedVisibleDate.Date)
            {
                warnings.Add($"右侧顶部日期识别已结合左侧账户列表纠正为 {correctedVisibleDate:yyyy-MM-dd}。");
            }
            else
            {
                warnings.Add($"已识别右侧明细日期 {correctedVisibleDate:yyyy-MM-dd}，并按该日期回填左侧账户与右侧流水。");
            }

            return correctedVisibleDate.Date;
        }

        if (detailDateCandidate?.Date is DateTime recognizedDate)
        {
            if (visibleDates.Contains(recognizedDate.Date)
                || Math.Abs((recognizedDate.Date - importDate.Date).TotalDays) <= 31)
            {
                warnings.Add(recognizedDate.Date != importDate.Date
                    ? $"已按右侧明细日期 {recognizedDate:yyyy-MM-dd} 匹配左侧账户行并回填当日数据。"
                    : $"已识别右侧明细日期 {recognizedDate:yyyy-MM-dd}，并按该日期回填左侧账户与右侧流水。");
                return recognizedDate.Date;
            }

            if (visibleDates.Contains(importDate.Date))
            {
                warnings.Add($"右侧顶部日期识别为 {recognizedDate:yyyy-MM-dd}，但与左侧账户列表不一致，已改用录入日期 {importDate:yyyy-MM-dd}。");
                return importDate.Date;
            }
        }

        if (visibleDates.Contains(importDate.Date))
        {
            warnings.Add($"右侧顶部日期未稳定识别，已改用录入日期 {importDate:yyyy-MM-dd}。");
            return importDate.Date;
        }

        warnings.Add($"未识别到稳定的右侧明细日期，已按录入日期 {importDate:yyyy-MM-dd} 回填。");
        return importDate.Date;
    }

    private async Task<List<PortfolioPositionImportResponse>> ParseDailyFlowPositionsAsync(
        List<OcrToken> tokens,
        int userId,
        DateTime importDate,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var lines = GroupLines(tokens, 26f);
        var headerIndex = lines.FindIndex(IsDailyFlowHeaderLine);
        if (headerIndex < 0)
        {
            warnings.Add("未识别到当日流水表头，请确认截图中包含“当日买入/当日卖出/收盘价”等列。");
            return [];
        }

        if (!TryBuildFlowColumnLayout(lines[headerIndex], out var layout))
        {
            warnings.Add("当日流水表列位置识别失败，请换一张包含完整表头的截图重试。");
            return [];
        }

        var positions = new List<PortfolioPositionImportResponse>();
        for (var i = headerIndex + 1; i < lines.Count; i++)
        {
            var line = lines[i];
            if (line.Count == 0 || IsDailyFlowHeaderLine(line))
            {
                continue;
            }

            var nameTokens = line
                .Where(token => token.CenterX < layout.NameRightBoundary)
                .OrderBy(token => token.XMin)
                .ToList();
            if (!TryGetFlowIdentity(nameTokens, out var stockCode, out var stockName))
            {
                continue;
            }

            var flowTexts = BuildFlowRowTexts(line, layout);
            RepairMergedFlowPriceTexts(flowTexts);
            var candidate = new FlowPositionCandidate
            {
                StockCode = stockCode,
                StockName = stockName,
                DailyPnL = ExtractFirstNonPercentNumber(flowTexts.DailyPnLText),
                PositionQuantity = ParseIntOrZero(flowTexts.PositionQuantityText),
                BuyQuantity = ParseIntOrZero(flowTexts.BuyQuantityText),
                SellQuantity = ParseIntOrZero(flowTexts.SellQuantityText),
                BuyPrice = ParseNumberOrZero(flowTexts.BuyPriceText),
                SellPrice = ParseNumberOrZero(flowTexts.SellPriceText),
                ClosePrice = ParseNumberOrZero(flowTexts.ClosePriceText)
            };

            RepairMergedZeroFlowColumns(candidate, flowTexts);

            if (candidate.PositionQuantity == 0
                && candidate.BuyQuantity == 0
                && candidate.SellQuantity == 0
                && candidate.ClosePrice == 0
                && candidate.DailyPnL == 0)
            {
                continue;
            }

            var normalized = await NormalizeDailyFlowPositionAsync(candidate, userId, importDate, warnings, cancellationToken);
            if (normalized != null)
            {
                positions.Add(normalized);
            }
        }

        if (positions.Count == 0)
        {
            warnings.Add("未识别到有效的当日流水明细，请尽量保留完整表头和股票列表。");
        }

        return positions;
    }

    private async Task<List<PortfolioPositionImportResponse>> ParsePositionsAsync(
        List<OcrToken> tokens,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var holdingsToken = tokens.FirstOrDefault(token => token.Text.Contains("持仓股", StringComparison.OrdinalIgnoreCase));
        var relevantTokens = (holdingsToken == null ? tokens : tokens.Where(token => token.YMin > holdingsToken.YMax + 20))
            .OrderBy(token => token.CenterY)
            .ThenBy(token => token.XMin)
            .ToList();

        var lines = GroupLines(relevantTokens, 26f);
        var positions = new List<PortfolioPositionImportResponse>();

        for (var i = 0; i < lines.Count; i++)
        {
            var currentLine = lines[i];
            if (IsHeaderOrSeparatorLine(currentLine))
            {
                continue;
            }

            if (!TryGetIdentity(currentLine, out var recognizedStockCode, out var recognizedStockName, out var nameToken))
            {
                continue;
            }

            var topNumbers = currentLine
                .Where(token => token != nameToken && IsNumericLike(token.Text))
                .OrderBy(token => token.XMin)
                .ToList();

            if (topNumbers.Count < 4)
            {
                continue;
            }

            if (i + 1 >= lines.Count)
            {
                warnings.Add($"持仓 {recognizedStockName} 缺少下一行详情，已跳过。");
                continue;
            }

            var nextLine = lines[i + 1];
            if (IsHeaderOrSeparatorLine(nextLine))
            {
                warnings.Add($"持仓 {recognizedStockName} 缺少市值/现价行，已跳过。");
                continue;
            }

            var bottomNumbers = nextLine
                .Where(token => IsNumericLike(token.Text))
                .OrderBy(token => token.XMin)
                .ToList();

            if (bottomNumbers.Count < 4)
            {
                warnings.Add($"持仓 {recognizedStockName} 的详情行数字不足，已跳过。");
                continue;
            }

            var raw = new PositionCandidate
            {
                StockCode = recognizedStockCode,
                StockName = recognizedStockName,
                PositionPnL = ParseNumberOrZero(topNumbers.ElementAtOrDefault(0)?.Text),
                PositionQuantity = ParseIntOrZero(topNumbers.ElementAtOrDefault(1)?.Text),
                CostPrice = ParseNumberOrZero(topNumbers.ElementAtOrDefault(2)?.Text),
                DailyPnL = ParseNumberOrZero(topNumbers.ElementAtOrDefault(3)?.Text),
                MarketValue = ParseNumberOrZero(bottomNumbers.ElementAtOrDefault(0)?.Text),
                CurrentPrice = ParseNumberOrZero(bottomNumbers.ElementAtOrDefault(3)?.Text)
            };

            var normalized = await NormalizePositionAsync(raw, warnings, cancellationToken);
            if (normalized != null)
            {
                positions.Add(normalized);
            }

            i++;
        }

        if (positions.Count == 0)
        {
            warnings.Add("未识别到有效持仓明细，请优先使用完整的同花顺持仓页整屏截图。");
        }

        return positions;
    }

    private async Task<List<PortfolioPositionImportResponse>> ParseMobileHoldingsPositionsAsync(
        List<OcrToken> tokens,
        List<string> warnings,
        CancellationToken cancellationToken,
        bool warnIfEmpty)
    {
        var lines = GroupLines(tokens, 26f);
        var headerIndex = lines.FindIndex(IsMobileHoldingsHeaderLine);
        if (headerIndex < 0)
        {
            if (warnIfEmpty)
            {
                warnings.Add("未识别到手机持仓列表表头，请确认截图中包含“市值 / 盈亏 / 持仓可用 / 成本现价 / 当日盈亏”等列。");
            }

            return [];
        }

        if (!TryBuildMobileHoldingsColumnLayout(lines[headerIndex], out var layout))
        {
            if (warnIfEmpty)
            {
                warnings.Add("手机持仓列表列位置识别失败，请尽量上传完整整屏截图。");
            }

            return [];
        }

        var positions = new List<PortfolioPositionImportResponse>();
        for (var i = headerIndex + 1; i < lines.Count; i++)
        {
            var topLine = lines[i];
            if (IsHeaderOrSeparatorLine(topLine) || !TryGetMobileHoldingIdentity(topLine, layout, out var stockName))
            {
                continue;
            }

            var nextLineIndex = FindNextMobileHoldingDetailLineIndex(lines, i + 1);
            if (nextLineIndex < 0)
            {
                warnings.Add($"持仓 {stockName} 缺少下一行详情，已跳过。");
                continue;
            }

            var topTexts = BuildMobileHoldingTopRowTexts(topLine, layout);
            var bottomTexts = BuildMobileHoldingBottomRowTexts(lines[nextLineIndex], layout);
            var candidate = new PositionCandidate
            {
                StockName = stockName,
                PositionPnL = ExtractLastNonPercentNumber(topTexts.PositionPnLText),
                PositionQuantity = ParseIntOrZero(topTexts.PositionQuantityText),
                CostPrice = ExtractLastNonPercentNumber(topTexts.CostPriceText),
                DailyPnL = ExtractLastNonPercentNumber(topTexts.DailyPnLText),
                MarketValue = ExtractLastNonPercentNumber(bottomTexts.MarketValueText),
                CurrentPrice = ExtractLastNonPercentNumber(bottomTexts.CurrentPriceText)
            };

            if (candidate.PositionQuantity == 0
                && candidate.CostPrice == 0
                && candidate.CurrentPrice == 0
                && candidate.PositionPnL == 0
                && candidate.DailyPnL == 0
                && candidate.MarketValue == 0)
            {
                continue;
            }

            var normalized = await NormalizePositionAsync(candidate, warnings, cancellationToken);
            if (normalized != null)
            {
                positions.Add(normalized);
            }

            i = nextLineIndex;
        }

        if (positions.Count == 0 && warnIfEmpty)
        {
            warnings.Add("未识别到有效的手机持仓明细，请尽量保留完整股票列表与列标题。");
        }

        return positions;
    }

    private static bool TryGetIdentity(
        List<OcrToken> line,
        out string stockCode,
        out string stockName,
        out OcrToken? nameToken)
    {
        var codeToken = line.FirstOrDefault(token => NormalizeStockCode(token.Text).Length == 6 && token.XMin < 160);
        nameToken = line
            .Where(token => token != codeToken && token.XMin < 240 && LooksLikeStockName(token.Text))
            .OrderBy(token => token.XMin)
            .FirstOrDefault();

        stockCode = codeToken == null ? string.Empty : NormalizeStockCode(codeToken.Text);
        stockName = nameToken?.Text.Trim() ?? string.Empty;

        return !string.IsNullOrWhiteSpace(stockName);
    }

    private static bool IsHeaderOrSeparatorLine(List<OcrToken> line)
    {
        if (line.Count == 0)
        {
            return true;
        }

        var joined = string.Join(" ", line.Select(token => token.Text));
        if (joined.Contains("隐藏", StringComparison.OrdinalIgnoreCase) && line.Count <= 3)
        {
            return true;
        }

        return NoiseTexts.Any(text => joined.Contains(text, StringComparison.OrdinalIgnoreCase))
            && !line.Any(token => token.XMin < 220 && LooksLikeStockName(token.Text));
    }

    private async Task<PortfolioPositionImportResponse?> NormalizePositionAsync(
        PositionCandidate candidate,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var stock = await ResolveStockAsync(candidate.StockCode, candidate.StockName, cancellationToken);
        var stockCode = !string.IsNullOrWhiteSpace(candidate.StockCode)
            ? candidate.StockCode
            : stock?.StockCode ?? string.Empty;

        if (string.IsNullOrWhiteSpace(stockCode))
        {
            warnings.Add($"无法为持仓 {candidate.StockName} 反查股票代码，已跳过。");
            return null;
        }

        return new PortfolioPositionImportResponse
        {
            StockCode = stockCode,
            StockName = stock?.StockName ?? candidate.StockName,
            Board = stock?.Board ?? GuessBoard(stockCode),
            BuyPrice = 0,
            BuyQuantity = 0,
            SellPrice = 0,
            SellQuantity = 0,
            PositionQuantity = candidate.PositionQuantity,
            CostPrice = candidate.CostPrice,
            CurrentPrice = candidate.CurrentPrice,
            PositionPnL = candidate.PositionPnL,
            CumulativePnL = candidate.PositionPnL,
            DailyPnL = candidate.DailyPnL,
            MarketValue = candidate.MarketValue,
            IsLiquidated = candidate.PositionQuantity == 0 || candidate.MarketValue == 0
        };
    }

    private async Task<PortfolioPositionImportResponse?> NormalizeDailyFlowPositionAsync(
        FlowPositionCandidate candidate,
        int userId,
        DateTime importDate,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var stock = await ResolveStockAsync(candidate.StockCode, candidate.StockName, cancellationToken);
        var stockCode = !string.IsNullOrWhiteSpace(candidate.StockCode)
            ? candidate.StockCode
            : stock?.StockCode ?? string.Empty;

        if (string.IsNullOrWhiteSpace(stockCode))
        {
            warnings.Add($"无法为流水股票 {candidate.StockName} 反查股票代码，已跳过。");
            return null;
        }

        var previousRecord = await GetPreviousRecordAsync(userId, stockCode, stock?.StockName ?? candidate.StockName, importDate, cancellationToken);
        var cumulativePnL = (previousRecord?.CumulativePnL ?? 0) + candidate.DailyPnL;
        var isLiquidated = candidate.PositionQuantity <= 0;

        if (isLiquidated && previousRecord == null)
        {
            warnings.Add($"股票 {candidate.StockName} 在 {importDate:yyyy-MM-dd} 前未找到历史持仓，清仓累计盈亏已按当日盈亏处理。");
        }

        var derivedCostPrice = isLiquidated
            ? previousRecord?.CostPrice ?? (candidate.BuyPrice > 0 ? candidate.BuyPrice : 0)
            : DeriveCostPrice(candidate.ClosePrice, cumulativePnL, candidate.PositionQuantity, previousRecord?.CostPrice ?? candidate.BuyPrice);

        return new PortfolioPositionImportResponse
        {
            StockCode = stockCode,
            StockName = stock?.StockName ?? candidate.StockName,
            Board = stock?.Board ?? GuessBoard(stockCode),
            BuyPrice = candidate.BuyPrice,
            BuyQuantity = candidate.BuyQuantity,
            SellPrice = candidate.SellPrice,
            SellQuantity = candidate.SellQuantity,
            PositionQuantity = Math.Max(0, candidate.PositionQuantity),
            CostPrice = derivedCostPrice,
            CurrentPrice = candidate.ClosePrice,
            PositionPnL = cumulativePnL,
            CumulativePnL = cumulativePnL,
            DailyPnL = candidate.DailyPnL,
            MarketValue = candidate.PositionQuantity > 0
                ? decimal.Round(candidate.ClosePrice * candidate.PositionQuantity, 2, MidpointRounding.AwayFromZero)
                : 0,
            IsLiquidated = isLiquidated
        };
    }

    private async Task<StockTrade?> GetPreviousRecordAsync(
        int userId,
        string stockCode,
        string stockName,
        DateTime importDate,
        CancellationToken cancellationToken)
    {
        var date = importDate.Date;
        if (!string.IsNullOrWhiteSpace(stockCode))
        {
            return await _db.StockTrades
                .AsNoTracking()
                .Where(trade => trade.UserId == userId)
                .Where(trade => trade.StockCode == stockCode && trade.TradeDate < date)
                .OrderByDescending(trade => trade.TradeDate)
                .ThenByDescending(trade => trade.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return await _db.StockTrades
            .AsNoTracking()
            .Where(trade => trade.UserId == userId)
            .Where(trade => trade.StockName == stockName && trade.TradeDate < date)
            .OrderByDescending(trade => trade.TradeDate)
            .ThenByDescending(trade => trade.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<StockBasic?> ResolveStockAsync(
        string stockCode,
        string stockName,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(stockCode))
        {
            return await _stockSearchService.GetStockByCodeAsync(stockCode);
        }

        if (string.IsNullOrWhiteSpace(stockName))
        {
            return null;
        }

        var candidates = new Dictionary<string, StockBasic>(StringComparer.Ordinal);
        foreach (var keyword in BuildStockSearchKeywords(stockName))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var results = await _stockSearchService.SearchStocksAsync(keyword);
            foreach (var result in results)
            {
                candidates[result.StockCode] = result;
            }
        }

        if (candidates.Count == 0)
        {
            return null;
        }

        var normalizedInput = NormalizeStockName(stockName);
        return candidates.Values
            .OrderByDescending(stock => MatchStockNameScore(normalizedInput, NormalizeStockName(stock.StockName)))
            .ThenBy(stock => stock.StockName.Length)
            .FirstOrDefault();
    }

    private static IEnumerable<string> BuildStockSearchKeywords(string stockName)
    {
        var original = stockName.Trim();
        var normalized = NormalizeStockName(original);
        var stripped = Regex.Replace(normalized, "^(?:ST)+", string.Empty, RegexOptions.IgnoreCase);

        var keywords = new List<string> { original, normalized, stripped };
        foreach (var name in new[] { normalized, stripped })
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            if (name.Length >= 3)
            {
                keywords.Add(name[..3]);
            }

            if (name.Length >= 2)
            {
                keywords.Add(name[..2]);
            }

            if (name.Length >= 3)
            {
                keywords.Add(name[1..]);
            }

            if (name.Length >= 4)
            {
                keywords.Add(name[1..^1]);
            }
        }

        return keywords
            .Where(keyword => !string.IsNullOrWhiteSpace(keyword))
            .Distinct(StringComparer.Ordinal);
    }

    private static int MatchStockNameScore(string source, string candidate)
    {
        if (source == candidate)
        {
            return 1000;
        }

        if (candidate.Contains(source, StringComparison.Ordinal) || source.Contains(candidate, StringComparison.Ordinal))
        {
            return 800 - Math.Abs(source.Length - candidate.Length);
        }

        return 500 - LevenshteinDistance(source, candidate);
    }

    private static string NormalizeStockName(string stockName)
    {
        return Regex.Replace(stockName.Trim().ToUpperInvariant(), "[^\\p{L}\\p{Nd}\\*]", string.Empty);
    }

    private static int LevenshteinDistance(string source, string target)
    {
        if (source.Length == 0) return target.Length;
        if (target.Length == 0) return source.Length;

        var matrix = new int[source.Length + 1, target.Length + 1];
        for (var i = 0; i <= source.Length; i++) matrix[i, 0] = i;
        for (var j = 0; j <= target.Length; j++) matrix[0, j] = j;

        for (var i = 1; i <= source.Length; i++)
        {
            for (var j = 1; j <= target.Length; j++)
            {
                var cost = source[i - 1] == target[j - 1] ? 0 : 1;
                matrix[i, j] = Math.Min(
                    Math.Min(matrix[i - 1, j] + 1, matrix[i, j - 1] + 1),
                    matrix[i - 1, j - 1] + cost);
            }
        }

        return matrix[source.Length, target.Length];
    }

    private static string NormalizeStockCode(string? stockCode)
    {
        if (string.IsNullOrWhiteSpace(stockCode))
        {
            return string.Empty;
        }

        var normalized = stockCode
            .Trim()
            .ToUpperInvariant()
            .Replace('O', '0')
            .Replace('I', '1')
            .Replace('L', '1')
            .Replace('S', '5')
            .Replace('B', '8');

        normalized = Regex.Replace(normalized, "[^0-9]", string.Empty);
        if (normalized.Length == 5)
        {
            normalized = "0" + normalized;
        }

        return normalized.Length == 6 ? normalized : string.Empty;
    }

    private static bool LooksLikeStockName(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        if (NoiseTexts.Any(noise => text.Contains(noise, StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        if (IsNumericLike(text))
        {
            return false;
        }

        return text.Any(ch => char.IsLetterOrDigit(ch) || ch == '*' || IsChinese(ch));
    }

    private static bool TryParseDateText(string text, out DateTime date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        var normalizedText = NormalizeDateTextForParsing(text);
        foreach (var pattern in DatePatterns)
        {
            foreach (Match match in pattern.Matches(normalizedText))
            {
                if (!match.Success)
                {
                    continue;
                }

                if (!int.TryParse(match.Groups["year"].Value, out var year)
                    || !int.TryParse(match.Groups["month"].Value, out var month)
                    || !int.TryParse(match.Groups["day"].Value, out var day))
                {
                    continue;
                }

                try
                {
                    date = new DateTime(year, month, day);
                    return true;
                }
                catch
                {
                    // 继续尝试后续候选日期
                }
            }
        }

        return false;
    }

    private static bool IsDailyFlowHeaderLine(List<OcrToken> line)
    {
        var joined = NormalizeFlowHeaderText(string.Concat(line.Select(token => token.Text)));
        return DailyFlowHeaderHints.Count(header => joined.Contains(NormalizeFlowHeaderText(header), StringComparison.OrdinalIgnoreCase)) >= 4;
    }

    private static bool IsAccountHistoryHeaderLine(List<OcrToken> line)
    {
        var joined = NormalizeFlowHeaderText(string.Concat(line.Select(token => token.Text)));
        return AccountHistoryHeaderHints.Count(header => joined.Contains(NormalizeFlowHeaderText(header), StringComparison.OrdinalIgnoreCase)) >= 3;
    }

    private static bool IsMobileHoldingsHeaderLine(List<OcrToken> line)
    {
        var joined = NormalizeFlowHeaderText(string.Concat(line.Select(token => token.Text)));
        return MobileHoldingsHeaderHints.Count(header => joined.Contains(NormalizeFlowHeaderText(header), StringComparison.OrdinalIgnoreCase)) >= 4;
    }

    private static bool TryBuildFlowColumnLayout(List<OcrToken> headerLine, out FlowColumnLayout layout)
    {
        layout = new FlowColumnLayout();

        var centers = FlowHeaderOrder.ToDictionary(label => label, label => FindHeaderCenter(headerLine, label));
        InferMissingFlowCenters(centers);

        if (centers["证券名称"] == null
            || centers["当日盈亏"] == null
            || centers["持仓数量"] == null
            || centers["当日买入"] == null
            || centers["当日卖出"] == null
            || centers["买入均价"] == null
            || centers["卖出均价"] == null
            || centers["收盘价"] == null)
        {
            return false;
        }

        var stockNameCenter = centers["证券名称"]!.Value;
        var dailyPnLCenter = centers["当日盈亏"]!.Value;
        var dailyPnLRatioCenter = centers["当日盈亏比"];
        var positionQuantityCenter = centers["持仓数量"]!.Value;
        var buyQuantityCenter = centers["当日买入"]!.Value;
        var sellQuantityCenter = centers["当日卖出"]!.Value;
        var buyPriceCenter = centers["买入均价"]!.Value;
        var sellPriceCenter = centers["卖出均价"]!.Value;
        var closePriceCenter = centers["收盘价"]!.Value;

        layout.NameRightBoundary = GetMidPoint(stockNameCenter, dailyPnLCenter);
        layout.DailyPnLCenter = dailyPnLCenter;
        layout.DailyPnLRatioCenter = dailyPnLRatioCenter ?? GetMidPoint(dailyPnLCenter, positionQuantityCenter);
        layout.PositionQuantityCenter = positionQuantityCenter;
        layout.BuyQuantityCenter = buyQuantityCenter;
        layout.SellQuantityCenter = sellQuantityCenter;
        layout.BuyPriceCenter = buyPriceCenter;
        layout.SellPriceCenter = sellPriceCenter;
        layout.ClosePriceCenter = closePriceCenter;
        layout.DailyPnLRightBoundary = dailyPnLRatioCenter != null
            ? GetMidPoint(dailyPnLCenter, dailyPnLRatioCenter.Value)
            : GetMidPoint(dailyPnLCenter, positionQuantityCenter);
        layout.DailyPnLRatioRightBoundary = dailyPnLRatioCenter != null
            ? GetMidPoint(dailyPnLRatioCenter.Value, positionQuantityCenter)
            : GetMidPoint(dailyPnLCenter, positionQuantityCenter);
        layout.PositionQuantityRightBoundary = GetMidPoint(positionQuantityCenter, buyQuantityCenter);
        layout.BuyQuantityRightBoundary = GetMidPoint(buyQuantityCenter, sellQuantityCenter);
        layout.SellQuantityRightBoundary = GetMidPoint(sellQuantityCenter, buyPriceCenter);
        layout.BuyPriceRightBoundary = GetMidPoint(buyPriceCenter, sellPriceCenter);
        layout.SellPriceRightBoundary = GetMidPoint(sellPriceCenter, closePriceCenter);

        return true;
    }

    private static bool TryBuildAccountHistoryLayout(List<OcrToken> headerLine, out AccountHistoryColumnLayout layout)
    {
        layout = new AccountHistoryColumnLayout();

        var dateCenter = FindHeaderCenter(headerLine, "日期");
        var feeCenter = FindHeaderCenter(headerLine, "费用合计");
        var positionValueCenter = FindHeaderCenter(headerLine, "市值");
        var totalAssetsCenter = FindHeaderCenter(headerLine, "总资产");

        if (dateCenter == null
            || positionValueCenter == null
            || totalAssetsCenter == null)
        {
            return false;
        }

        layout.DateRightBoundary = feeCenter != null
            ? GetMidPoint(dateCenter.Value, feeCenter.Value)
            : GetMidPoint(dateCenter.Value, positionValueCenter.Value);

        return true;
    }

    private static bool TryBuildMobileHoldingsColumnLayout(List<OcrToken> headerLine, out MobileHoldingsColumnLayout layout)
    {
        layout = new MobileHoldingsColumnLayout();

        var marketValueCenter = FindHeaderCenter(headerLine, "市值");
        var positionPnLCenter = FindHeaderCenter(headerLine, "盈亏");
        var positionQuantityCenter = FindHeaderCenter(headerLine, "持仓/可用");
        var costPriceCenter = FindHeaderCenter(headerLine, "成本/现价");
        var dailyPnLCenter = FindHeaderCenter(headerLine, "当日盈亏");

        if (marketValueCenter == null
            || positionPnLCenter == null
            || positionQuantityCenter == null
            || costPriceCenter == null
            || dailyPnLCenter == null)
        {
            return false;
        }

        layout.TopNameRightBoundary = GetMidPoint(marketValueCenter.Value, positionPnLCenter.Value);
        layout.MarketValueCenter = marketValueCenter.Value;
        layout.PositionPnLCenter = positionPnLCenter.Value;
        layout.PositionQuantityCenter = positionQuantityCenter.Value;
        layout.CostPriceCenter = costPriceCenter.Value;
        layout.DailyPnLCenter = dailyPnLCenter.Value;

        return true;
    }

    private static float? FindHeaderCenter(List<OcrToken> headerLine, string label)
    {
        var aliases = GetHeaderAliases(label)
            .Select(NormalizeFlowHeaderText)
            .Where(alias => !string.IsNullOrWhiteSpace(alias))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(alias => alias.Length)
            .ToList();

        if (aliases.Count == 0)
        {
            return null;
        }

        HeaderMatchCandidate? bestCandidate = null;
        var maxSpan = Math.Min(5, headerLine.Count);

        for (var span = 1; span <= maxSpan; span++)
        {
            for (var i = 0; i <= headerLine.Count - span; i++)
            {
                var tokenSpan = headerLine
                    .Skip(i)
                    .Take(span)
                    .ToList();
                var normalizedSpan = NormalizeFlowHeaderText(string.Concat(tokenSpan.Select(token => token.Text)));
                if (string.IsNullOrWhiteSpace(normalizedSpan))
                {
                    continue;
                }

                foreach (var alias in aliases)
                {
                    if (!TryBuildHeaderMatchCandidate(tokenSpan, normalizedSpan, alias, out var candidate))
                    {
                        continue;
                    }

                    if (bestCandidate == null || IsBetterHeaderCandidate(candidate, bestCandidate.Value))
                    {
                        bestCandidate = candidate;
                    }
                }
            }
        }

        return bestCandidate?.Center;
    }

    private static string NormalizeFlowHeaderText(string text)
    {
        return Regex.Replace(text, @"[\s:：·\.\-_/]+", string.Empty);
    }

    private static IEnumerable<string> GetHeaderAliases(string label)
    {
        return HeaderAliases.TryGetValue(label, out var aliases)
            ? aliases
            : [label];
    }

    private static bool TryBuildHeaderMatchCandidate(
        List<OcrToken> tokenSpan,
        string normalizedSpan,
        string normalizedLabel,
        out HeaderMatchCandidate candidate)
    {
        candidate = default;

        if (string.Equals(normalizedSpan, normalizedLabel, StringComparison.OrdinalIgnoreCase))
        {
            candidate = new HeaderMatchCandidate
            {
                Priority = 0,
                Score = 0,
                Center = (tokenSpan[0].XMin + tokenSpan[^1].XMax) / 2f
            };

            return true;
        }

        var containsIndex = normalizedSpan.IndexOf(normalizedLabel, StringComparison.OrdinalIgnoreCase);
        if (containsIndex >= 0)
        {
            candidate = new HeaderMatchCandidate
            {
                Priority = 1,
                Score = 0,
                Center = EstimateHeaderSubstringCenter(tokenSpan, normalizedSpan, containsIndex, normalizedLabel.Length)
            };

            return true;
        }

        if (Math.Abs(normalizedSpan.Length - normalizedLabel.Length) > 2)
        {
            return false;
        }

        var distance = ComputeLevenshteinDistance(normalizedSpan, normalizedLabel);
        var maxDistance = Math.Max(1, normalizedLabel.Length / 3);
        if (distance > maxDistance)
        {
            return false;
        }

        candidate = new HeaderMatchCandidate
        {
            Priority = 2,
            Score = distance,
            Center = (tokenSpan[0].XMin + tokenSpan[^1].XMax) / 2f
        };

        return true;
    }

    private static bool IsBetterHeaderCandidate(HeaderMatchCandidate candidate, HeaderMatchCandidate currentBest)
    {
        if (candidate.Priority != currentBest.Priority)
        {
            return candidate.Priority < currentBest.Priority;
        }

        if (Math.Abs(candidate.Score - currentBest.Score) > 0.001)
        {
            return candidate.Score < currentBest.Score;
        }

        return false;
    }

    private static float EstimateHeaderSubstringCenter(
        List<OcrToken> tokenSpan,
        string normalizedSpan,
        int substringIndex,
        int substringLength)
    {
        var left = tokenSpan[0].XMin;
        var right = tokenSpan[^1].XMax;
        if (normalizedSpan.Length == 0 || right <= left)
        {
            return (left + right) / 2f;
        }

        var ratio = (substringIndex + (substringLength / 2f)) / normalizedSpan.Length;
        return left + ((right - left) * ratio);
    }

    private static int ComputeLevenshteinDistance(string left, string right)
    {
        if (string.Equals(left, right, StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }

        if (left.Length == 0)
        {
            return right.Length;
        }

        if (right.Length == 0)
        {
            return left.Length;
        }

        var dp = new int[left.Length + 1, right.Length + 1];
        for (var i = 0; i <= left.Length; i++)
        {
            dp[i, 0] = i;
        }

        for (var j = 0; j <= right.Length; j++)
        {
            dp[0, j] = j;
        }

        for (var i = 1; i <= left.Length; i++)
        {
            for (var j = 1; j <= right.Length; j++)
            {
                var cost = char.ToUpperInvariant(left[i - 1]) == char.ToUpperInvariant(right[j - 1]) ? 0 : 1;
                dp[i, j] = Math.Min(
                    Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1),
                    dp[i - 1, j - 1] + cost);
            }
        }

        return dp[left.Length, right.Length];
    }

    private static void InferMissingFlowCenters(Dictionary<string, float?> centers)
    {
        var spacingSamples = new List<float>();
        for (var leftIndex = 0; leftIndex < FlowHeaderOrder.Length; leftIndex++)
        {
            var leftCenter = centers[FlowHeaderOrder[leftIndex]];
            if (leftCenter == null)
            {
                continue;
            }

            for (var rightIndex = leftIndex + 1; rightIndex < FlowHeaderOrder.Length; rightIndex++)
            {
                var rightCenter = centers[FlowHeaderOrder[rightIndex]];
                if (rightCenter == null)
                {
                    continue;
                }

                spacingSamples.Add((rightCenter.Value - leftCenter.Value) / (rightIndex - leftIndex));
            }
        }

        var defaultSpacing = spacingSamples.Count > 0
            ? spacingSamples.Average()
            : 120f;

        var changed = true;
        while (changed)
        {
            changed = false;

            for (var index = 0; index < FlowHeaderOrder.Length; index++)
            {
                var label = FlowHeaderOrder[index];
                if (centers[label] != null)
                {
                    continue;
                }

                var leftKnownIndex = index - 1;
                while (leftKnownIndex >= 0 && centers[FlowHeaderOrder[leftKnownIndex]] == null)
                {
                    leftKnownIndex--;
                }

                var rightKnownIndex = index + 1;
                while (rightKnownIndex < FlowHeaderOrder.Length && centers[FlowHeaderOrder[rightKnownIndex]] == null)
                {
                    rightKnownIndex++;
                }

                if (leftKnownIndex >= 0 && rightKnownIndex < FlowHeaderOrder.Length)
                {
                    var leftCenter = centers[FlowHeaderOrder[leftKnownIndex]]!.Value;
                    var rightCenter = centers[FlowHeaderOrder[rightKnownIndex]]!.Value;
                    centers[label] = leftCenter + ((rightCenter - leftCenter) * (index - leftKnownIndex) / (rightKnownIndex - leftKnownIndex));
                    changed = true;
                    continue;
                }

                if (leftKnownIndex >= 0)
                {
                    var leftCenter = centers[FlowHeaderOrder[leftKnownIndex]]!.Value;
                    centers[label] = leftCenter + (defaultSpacing * (index - leftKnownIndex));
                    changed = true;
                    continue;
                }

                if (rightKnownIndex < FlowHeaderOrder.Length)
                {
                    var rightCenter = centers[FlowHeaderOrder[rightKnownIndex]]!.Value;
                    centers[label] = rightCenter - (defaultSpacing * (rightKnownIndex - index));
                    changed = true;
                }
            }
        }
    }

    private static decimal? ParseFlowSummaryDailyPnL(List<OcrToken> tokens)
    {
        var summaryLine = GroupLines(tokens, 26f)
            .FirstOrDefault(line =>
                line.Any(token => token.Text.Contains("当日盈亏", StringComparison.OrdinalIgnoreCase))
                && line.Any(token => TryParseNumber(token.Text, out _)));

        if (summaryLine == null)
        {
            return null;
        }

        var labelIndex = summaryLine.FindIndex(token => token.Text.Contains("当日盈亏", StringComparison.OrdinalIgnoreCase));
        var text = labelIndex >= 0
            ? string.Concat(summaryLine.Skip(labelIndex).Select(token => token.Text))
            : string.Concat(summaryLine.Select(token => token.Text));

        return ExtractFirstNonPercentNumber(text);
    }

    private static decimal ResolveDailyFlowDailyPnL(
        List<PortfolioPositionImportResponse> positions,
        List<OcrToken> tokens,
        List<string> warnings)
    {
        var summaryDailyPnL = ParseFlowSummaryDailyPnL(tokens);
        if (positions.Count == 0)
        {
            return summaryDailyPnL ?? 0;
        }

        var detailDailyPnL = positions.Sum(position => position.DailyPnL);
        if (summaryDailyPnL.HasValue
            && Math.Abs(detailDailyPnL - summaryDailyPnL.Value) > 0.5m)
        {
            warnings.Add($"右侧流水逐笔合计为 {detailDailyPnL:F2}，与顶部当日盈亏 {summaryDailyPnL.Value:F2} 不一致，已优先采用顶部汇总值。");
            return summaryDailyPnL.Value;
        }

        return detailDailyPnL;
    }

    private static FlowRowText BuildFlowRowTexts(List<OcrToken> line, FlowColumnLayout layout)
    {
        var texts = new FlowRowText();
        var flowTokens = line
            .Where(token => token.CenterX >= layout.NameRightBoundary)
            .OrderBy(token => token.XMin)
            .ToList();

        var buckets = new Dictionary<string, List<OcrToken>>
        {
            ["dailyPnL"] = [],
            ["dailyPnLRatio"] = [],
            ["positionQuantity"] = [],
            ["buyQuantity"] = [],
            ["sellQuantity"] = [],
            ["buyPrice"] = [],
            ["sellPrice"] = [],
            ["closePrice"] = []
        };

        foreach (var token in flowTokens)
        {
            var key = GetNearestFlowColumnKey(token.CenterX, layout);
            buckets[key].Add(token);
        }

        texts.DailyPnLText = string.Concat(buckets["dailyPnL"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.DailyPnLRatioText = string.Concat(buckets["dailyPnLRatio"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.PositionQuantityText = string.Concat(buckets["positionQuantity"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.BuyQuantityText = string.Concat(buckets["buyQuantity"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.SellQuantityText = string.Concat(buckets["sellQuantity"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.BuyPriceText = string.Concat(buckets["buyPrice"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.SellPriceText = string.Concat(buckets["sellPrice"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.ClosePriceText = string.Concat(buckets["closePrice"].OrderBy(token => token.XMin).Select(token => token.Text));

        return texts;
    }

    private static void RepairMergedFlowPriceTexts(FlowRowText texts)
    {
        texts.BuyPriceText = ExtractSingleThreeDecimalPrice(texts.BuyPriceText) ?? texts.BuyPriceText;

        var trailingPrices = ExtractThreeDecimalPrices($"{texts.SellPriceText}{texts.ClosePriceText}");
        if (trailingPrices.Count >= 2)
        {
            texts.SellPriceText = trailingPrices[^2];
            texts.ClosePriceText = trailingPrices[^1];
            return;
        }

        if (trailingPrices.Count == 1)
        {
            if (string.IsNullOrWhiteSpace(texts.SellPriceText))
            {
                texts.SellPriceText = "0.000";
            }

            texts.ClosePriceText = trailingPrices[0];
            return;
        }

        texts.SellPriceText = ExtractSingleThreeDecimalPrice(texts.SellPriceText) ?? texts.SellPriceText;
        texts.ClosePriceText = ExtractSingleThreeDecimalPrice(texts.ClosePriceText) ?? texts.ClosePriceText;
    }

    private static List<string> ExtractThreeDecimalPrices(string text)
    {
        return ThreeDecimalPriceRegex.Matches(text ?? string.Empty)
            .Select(match => match.Value)
            .ToList();
    }

    private static string? ExtractSingleThreeDecimalPrice(string text)
    {
        return ExtractThreeDecimalPrices(text).LastOrDefault();
    }

    private static string GetNearestFlowColumnKey(float centerX, FlowColumnLayout layout)
    {
        var centers = new Dictionary<string, float>
        {
            ["dailyPnL"] = layout.DailyPnLCenter,
            ["dailyPnLRatio"] = layout.DailyPnLRatioCenter,
            ["positionQuantity"] = layout.PositionQuantityCenter,
            ["buyQuantity"] = layout.BuyQuantityCenter,
            ["sellQuantity"] = layout.SellQuantityCenter,
            ["buyPrice"] = layout.BuyPriceCenter,
            ["sellPrice"] = layout.SellPriceCenter,
            ["closePrice"] = layout.ClosePriceCenter
        };

        return centers
            .OrderBy(pair => Math.Abs(pair.Value - centerX))
            .First()
            .Key;
    }

    private static void RepairMergedZeroFlowColumns(FlowPositionCandidate candidate, FlowRowText texts)
    {
        if (candidate.PositionQuantity == 0
            && candidate.BuyPrice == 0
            && candidate.SellQuantity == 0
            && TrySplitMergedZeroQuantity(texts.BuyQuantityText, out var positionQuantity, out var buyQuantity))
        {
            candidate.PositionQuantity = positionQuantity;
            candidate.BuyQuantity = buyQuantity;
        }

        if (candidate.PositionQuantity == 0
            && candidate.SellPrice == 0
            && candidate.BuyQuantity == 0
            && TrySplitMergedZeroQuantity(texts.SellQuantityText, out var recoveredPositionQuantity, out var sellQuantity))
        {
            candidate.PositionQuantity = recoveredPositionQuantity;
            candidate.SellQuantity = sellQuantity;
        }
    }

    private static bool TrySplitMergedZeroQuantity(string text, out int leftValue, out int rightValue)
    {
        leftValue = 0;
        rightValue = 0;

        var digits = Regex.Replace(text ?? string.Empty, "[^0-9]", string.Empty);
        if (digits.Length < 2 || digits[^1] != '0')
        {
            return false;
        }

        if (!int.TryParse(digits[..^1], out leftValue)
            || !int.TryParse(digits[^1..], out rightValue))
        {
            leftValue = 0;
            rightValue = 0;
            return false;
        }

        return leftValue > 0;
    }

    private static DetailDateCandidate? FindSelectedDetailDateCandidate(List<OcrToken> tokens)
    {
        var lines = GroupLines(tokens, 26f);
        var headerIndex = lines.FindIndex(IsDailyFlowHeaderLine);
        var candidateLines = (headerIndex > 0 ? lines.Take(headerIndex) : lines)
            .Take(6)
            .Select(line =>
            {
                var rawText = string.Concat(line.Select(token => token.Text));
                var score = ScoreDetailDateLine(rawText, line);
                DateTime? parsedDate = null;

                if (TryParseDateText(rawText, out var lineDate))
                {
                    parsedDate = lineDate.Date;
                }
                else
                {
                    foreach (var token in line)
                    {
                        if (!TryParseDateText(token.Text, out var tokenDate))
                        {
                            continue;
                        }

                        parsedDate = tokenDate.Date;
                        break;
                    }
                }

                return new DetailDateCandidate
                {
                    RawText = rawText,
                    Score = score,
                    Top = line.Min(token => token.YMin),
                    Date = parsedDate
                };
            })
            .Where(candidate => candidate.Score > 0)
            .OrderByDescending(candidate => candidate.Score)
            .ThenByDescending(candidate => candidate.Date.HasValue)
            .ThenBy(candidate => candidate.Top)
            .ToList();

        return candidateLines.FirstOrDefault();
    }

    private static int ScoreDetailDateLine(string rawText, List<OcrToken> line)
    {
        if (string.IsNullOrWhiteSpace(rawText) || line.Count == 0)
        {
            return 0;
        }

        var score = 0;
        var normalizedDigits = NormalizeDateTextForComparison(rawText);
        if (rawText.Contains("星期", StringComparison.OrdinalIgnoreCase)
            || rawText.Contains("周", StringComparison.OrdinalIgnoreCase))
        {
            score += 5;
        }

        if (Regex.IsMatch(rawText, @"(?:19|20)\d{2}"))
        {
            score += 4;
        }

        if (normalizedDigits.Length >= 6)
        {
            score += 3;
        }

        if (rawText.Contains('-') || rawText.Contains('/') || rawText.Contains('年'))
        {
            score += 1;
        }

        return score;
    }

    private static string NormalizeDateTextForParsing(string text)
    {
        return (text ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Replace('O', '0')
            .Replace('Q', '0')
            .Replace('D', '0')
            .Replace('I', '1')
            .Replace('L', '1')
            .Replace('|', '1')
            .Replace('B', '8')
            .Replace('S', '5')
            .Replace('Z', '2');
    }

    private static string NormalizeDateTextForComparison(string text)
    {
        return Regex.Replace(NormalizeDateTextForParsing(text), "[^0-9]", string.Empty);
    }

    private static bool TryMatchVisibleDateFromRawText(
        string rawText,
        List<DateTime> visibleDates,
        DateTime preferredDate,
        out DateTime matchedDate)
    {
        matchedDate = default;
        if (visibleDates.Count == 0)
        {
            return false;
        }

        var normalized = NormalizeDateTextForComparison(rawText);
        if (normalized.Length < 6)
        {
            return false;
        }

        var hasWeekdayHint = TryExtractWeekdayHint(rawText, out var weekdayHint);
        var preferredDateValue = preferredDate.Date;
        var bestDate = default(DateTime);
        var bestDistance = int.MaxValue;
        var bestWeekdayMatch = false;
        var bestContainmentScore = -1;
        var bestPreferredMatch = false;
        foreach (var visibleDate in visibleDates)
        {
            var candidateDigits = visibleDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            var distance = ComputeBestDateTextDistance(normalized, candidateDigits);
            var weekdayMatch = hasWeekdayHint && visibleDate.DayOfWeek == weekdayHint;
            var containmentScore = ComputeDateContainmentScore(normalized, candidateDigits);
            var preferredMatch = visibleDate.Date == preferredDateValue;

            if (distance > bestDistance)
            {
                continue;
            }

            if (distance == bestDistance)
            {
                if (weekdayMatch != bestWeekdayMatch)
                {
                    if (!weekdayMatch)
                    {
                        continue;
                    }
                }
                else if (containmentScore != bestContainmentScore)
                {
                    if (containmentScore < bestContainmentScore)
                    {
                        continue;
                    }
                }
                else if (preferredMatch != bestPreferredMatch)
                {
                    if (!preferredMatch)
                    {
                        continue;
                    }
                }
                else
                {
                    continue;
                }
            }

            bestDistance = distance;
            bestDate = visibleDate.Date;
            bestWeekdayMatch = weekdayMatch;
            bestContainmentScore = containmentScore;
            bestPreferredMatch = preferredMatch;
        }

        if (bestDistance > 2)
        {
            return false;
        }

        matchedDate = bestDate;
        return true;
    }

    private static bool TryExtractWeekdayHint(string rawText, out DayOfWeek weekday)
    {
        weekday = default;
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return false;
        }

        var match = Regex.Match(rawText, @"(?:星期|周)\s*(?<weekday>[一二三四五六日天])", RegexOptions.IgnoreCase);
        if (!match.Success)
        {
            return false;
        }

        weekday = match.Groups["weekday"].Value switch
        {
            "一" => DayOfWeek.Monday,
            "二" => DayOfWeek.Tuesday,
            "三" => DayOfWeek.Wednesday,
            "四" => DayOfWeek.Thursday,
            "五" => DayOfWeek.Friday,
            "六" => DayOfWeek.Saturday,
            "日" or "天" => DayOfWeek.Sunday,
            _ => default
        };

        return true;
    }

    private static int ComputeDateContainmentScore(string normalizedRawText, string candidateDigits)
    {
        if (string.IsNullOrEmpty(normalizedRawText) || string.IsNullOrEmpty(candidateDigits))
        {
            return 0;
        }

        if (candidateDigits.Contains(normalizedRawText, StringComparison.Ordinal))
        {
            return 2;
        }

        if (normalizedRawText.Contains(candidateDigits, StringComparison.Ordinal))
        {
            return 1;
        }

        return 0;
    }

    private static int ComputeBestDateTextDistance(string normalizedRawText, string candidateDigits)
    {
        if (normalizedRawText.Length <= candidateDigits.Length)
        {
            return ComputeLevenshteinDistance(normalizedRawText, candidateDigits);
        }

        var bestDistance = int.MaxValue;
        for (var index = 0; index <= normalizedRawText.Length - candidateDigits.Length; index++)
        {
            var slice = normalizedRawText.Substring(index, candidateDigits.Length);
            var distance = ComputeLevenshteinDistance(slice, candidateDigits);
            if (distance < bestDistance)
            {
                bestDistance = distance;
            }
        }

        return bestDistance;
    }

    private static bool TryGetFlowIdentity(
        List<OcrToken> leftTokens,
        out string stockCode,
        out string stockName)
    {
        stockCode = string.Empty;
        stockName = string.Empty;

        if (leftTokens.Count == 0)
        {
            return false;
        }

        var codeToken = leftTokens.FirstOrDefault(token => NormalizeStockCode(token.Text).Length == 6);
        if (codeToken != null)
        {
            stockCode = NormalizeStockCode(codeToken.Text);
        }

        var hasLongNameToken = leftTokens.Any(token => NormalizeStockName(token.Text).Length >= 2);
        var stockNameParts = new List<string>();
        foreach (var token in leftTokens)
        {
            if (ReferenceEquals(token, codeToken))
            {
                var strippedName = Regex.Replace(token.Text, "[0-9OILSB]", string.Empty, RegexOptions.IgnoreCase);
                if (LooksLikeStockName(strippedName))
                {
                    stockNameParts.Add(strippedName);
                }

                continue;
            }

            if (hasLongNameToken && NormalizeStockName(token.Text).Length == 1)
            {
                continue;
            }

            if (LooksLikeStockName(token.Text))
            {
                stockNameParts.Add(token.Text);
            }
        }

        stockName = string.Concat(stockNameParts).Trim();
        if (string.IsNullOrWhiteSpace(stockName))
        {
            return false;
        }

        return true;
    }

    private static string JoinTokensInRange(List<OcrToken> line, float? minInclusive, float? maxExclusive)
    {
        return string.Concat(line
            .Where(token =>
                (!minInclusive.HasValue || token.CenterX >= minInclusive.Value)
                && (!maxExclusive.HasValue || token.CenterX < maxExclusive.Value))
            .OrderBy(token => token.XMin)
            .Select(token => token.Text));
    }

    private static bool TryGetMobileHoldingIdentity(
        List<OcrToken> line,
        MobileHoldingsColumnLayout layout,
        out string stockName)
    {
        var nameTokens = line
            .Where(token => token.CenterX < layout.TopNameRightBoundary && LooksLikeStockName(token.Text))
            .OrderBy(token => token.XMin)
            .ToList();

        stockName = string.Concat(nameTokens.Select(token => token.Text)).Trim();
        return !string.IsNullOrWhiteSpace(stockName)
            && !stockName.Contains("隐藏", StringComparison.OrdinalIgnoreCase);
    }

    private static int FindNextMobileHoldingDetailLineIndex(List<List<OcrToken>> lines, int startIndex)
    {
        for (var i = startIndex; i < lines.Count; i++)
        {
            if (lines[i].Count == 0 || IsMobileHoldingsHeaderLine(lines[i]))
            {
                continue;
            }

            if (IsHeaderOrSeparatorLine(lines[i]))
            {
                return -1;
            }

            if (lines[i].Any(token => IsNumericLike(token.Text)))
            {
                return i;
            }
        }

        return -1;
    }

    private static MobileHoldingTopRowText BuildMobileHoldingTopRowTexts(
        List<OcrToken> line,
        MobileHoldingsColumnLayout layout)
    {
        var texts = new MobileHoldingTopRowText();
        var buckets = new Dictionary<string, List<OcrToken>>
        {
            ["positionPnL"] = [],
            ["positionQuantity"] = [],
            ["costPrice"] = [],
            ["dailyPnL"] = []
        };

        foreach (var token in line
                     .Where(token => token.CenterX >= layout.TopNameRightBoundary && IsNumericLike(token.Text))
                     .OrderBy(token => token.XMin))
        {
            var key = GetNearestMobileHoldingTopColumnKey(token.CenterX, layout);
            buckets[key].Add(token);
        }

        texts.PositionPnLText = string.Concat(buckets["positionPnL"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.PositionQuantityText = string.Concat(buckets["positionQuantity"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.CostPriceText = string.Concat(buckets["costPrice"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.DailyPnLText = string.Concat(buckets["dailyPnL"].OrderBy(token => token.XMin).Select(token => token.Text));
        return texts;
    }

    private static MobileHoldingBottomRowText BuildMobileHoldingBottomRowTexts(
        List<OcrToken> line,
        MobileHoldingsColumnLayout layout)
    {
        var texts = new MobileHoldingBottomRowText();
        var buckets = new Dictionary<string, List<OcrToken>>
        {
            ["marketValue"] = [],
            ["positionPnL"] = [],
            ["positionQuantity"] = [],
            ["costPrice"] = [],
            ["dailyPnL"] = []
        };

        foreach (var token in line
                     .Where(token => IsNumericLike(token.Text))
                     .OrderBy(token => token.XMin))
        {
            var key = GetNearestMobileHoldingBottomColumnKey(token.CenterX, layout);
            buckets[key].Add(token);
        }

        texts.MarketValueText = string.Concat(buckets["marketValue"].OrderBy(token => token.XMin).Select(token => token.Text));
        texts.CurrentPriceText = string.Concat(buckets["costPrice"].OrderBy(token => token.XMin).Select(token => token.Text));
        return texts;
    }

    private static string GetNearestMobileHoldingTopColumnKey(float centerX, MobileHoldingsColumnLayout layout)
    {
        var centers = new Dictionary<string, float>
        {
            ["positionPnL"] = layout.PositionPnLCenter,
            ["positionQuantity"] = layout.PositionQuantityCenter,
            ["costPrice"] = layout.CostPriceCenter,
            ["dailyPnL"] = layout.DailyPnLCenter
        };

        return centers
            .OrderBy(pair => Math.Abs(pair.Value - centerX))
            .First()
            .Key;
    }

    private static string GetNearestMobileHoldingBottomColumnKey(float centerX, MobileHoldingsColumnLayout layout)
    {
        var centers = new Dictionary<string, float>
        {
            ["marketValue"] = layout.MarketValueCenter,
            ["positionPnL"] = layout.PositionPnLCenter,
            ["positionQuantity"] = layout.PositionQuantityCenter,
            ["costPrice"] = layout.CostPriceCenter,
            ["dailyPnL"] = layout.DailyPnLCenter
        };

        return centers
            .OrderBy(pair => Math.Abs(pair.Value - centerX))
            .First()
            .Key;
    }

    private static float GetMidPoint(float left, float right)
    {
        return (left + right) / 2f;
    }

    private static decimal ExtractFirstNonPercentNumber(string text)
    {
        var matches = Regex.Matches(NormalizeNumericText(text), @"[-+]?\d[\d,]*(?:\.\d+)?%?");
        foreach (Match match in matches)
        {
            if (match.Value.EndsWith('%'))
            {
                continue;
            }

            if (TryParseNumber(match.Value, out var value))
            {
                return value;
            }
        }

        return 0;
    }

    private static decimal ExtractLastNonPercentNumber(string text)
    {
        var matches = Regex.Matches(NormalizeNumericText(text), @"[-+]?\d[\d,]*(?:\.\d+)?%?");
        for (var index = matches.Count - 1; index >= 0; index--)
        {
            var match = matches[index];
            if (match.Value.EndsWith('%'))
            {
                continue;
            }

            if (TryParseNumber(match.Value, out var value))
            {
                return value;
            }
        }

        return 0;
    }

    private static decimal DeriveCostPrice(decimal closePrice, decimal cumulativePnL, int positionQuantity, decimal fallback)
    {
        if (positionQuantity <= 0 || closePrice <= 0)
        {
            return fallback;
        }

        var costPrice = closePrice - (cumulativePnL / positionQuantity);
        return decimal.Round(costPrice, 3, MidpointRounding.AwayFromZero);
    }

    private static List<List<OcrToken>> GroupLines(List<OcrToken> tokens, float tolerance)
    {
        var lines = new List<List<OcrToken>>();
        foreach (var token in tokens.OrderBy(token => token.CenterY).ThenBy(token => token.XMin))
        {
            if (lines.Count == 0)
            {
                lines.Add([token]);
                continue;
            }

            var lastLine = lines[^1];
            var avgCenterY = lastLine.Average(item => item.CenterY);
            if (Math.Abs(token.CenterY - avgCenterY) <= tolerance)
            {
                lastLine.Add(token);
            }
            else
            {
                lines.Add([token]);
            }
        }

        foreach (var line in lines)
        {
            line.Sort((a, b) => a.XMin.CompareTo(b.XMin));
        }

        return lines;
    }

    private static bool IsNumericLike(string text)
    {
        return NumberRegex.IsMatch(NormalizeNumericText(text));
    }

    private static bool TryParseNumber(string text, out decimal value)
    {
        value = 0;
        var match = NumberRegex.Match(NormalizeNumericText(text));
        if (!match.Success)
        {
            return false;
        }

        var normalized = match.Value.Replace(",", string.Empty);
        return decimal.TryParse(normalized, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out value);
    }

    private static decimal ParseNumberOrZero(string? text)
    {
        return text != null && TryParseNumber(text, out var value) ? value : 0;
    }

    private static int ParseIntOrZero(string? text)
    {
        if (text == null || !TryParseNumber(text, out var value))
        {
            return 0;
        }

        return (int)Math.Round(value, MidpointRounding.AwayFromZero);
    }

    private static string NormalizeNumericText(string? text)
    {
        return (text ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Replace('O', '0')
            .Replace('Q', '0')
            .Replace('D', '0')
            .Replace('I', '1')
            .Replace('L', '1')
            .Replace('|', '1')
            .Replace('S', '5')
            .Replace('B', '8')
            .Replace('—', '-')
            .Replace('–', '-')
            .Replace('−', '-')
            .Replace('﹣', '-');
    }

    private static bool IsChinese(char value)
    {
        return value >= '\u4e00' && value <= '\u9fff';
    }

    private static string GuessBoard(string stockCode)
    {
        if (stockCode.StartsWith("300", StringComparison.Ordinal))
            return "创业板";
        if (stockCode.StartsWith("688", StringComparison.Ordinal))
            return "科创板";
        if (stockCode.StartsWith("830", StringComparison.Ordinal)
            || stockCode.StartsWith("831", StringComparison.Ordinal)
            || stockCode.StartsWith("832", StringComparison.Ordinal)
            || stockCode.StartsWith("833", StringComparison.Ordinal))
            return "北交所";

        return "主板";
    }

    private sealed class OcrToken
    {
        public string Text { get; set; } = string.Empty;
        public float Score { get; set; }
        public float XMin { get; set; }
        public float XMax { get; set; }
        public float YMin { get; set; }
        public float YMax { get; set; }
        public float CenterX => (XMin + XMax) / 2;
        public float CenterY => (YMin + YMax) / 2;
    }

    private sealed class PositionCandidate
    {
        public string StockCode { get; set; } = string.Empty;
        public string StockName { get; set; } = string.Empty;
        public int PositionQuantity { get; set; }
        public decimal CostPrice { get; set; }
        public decimal CurrentPrice { get; set; }
        public decimal PositionPnL { get; set; }
        public decimal DailyPnL { get; set; }
        public decimal MarketValue { get; set; }
    }

    private sealed class FlowPositionCandidate
    {
        public string StockCode { get; set; } = string.Empty;
        public string StockName { get; set; } = string.Empty;
        public decimal DailyPnL { get; set; }
        public int PositionQuantity { get; set; }
        public int BuyQuantity { get; set; }
        public int SellQuantity { get; set; }
        public decimal BuyPrice { get; set; }
        public decimal SellPrice { get; set; }
        public decimal ClosePrice { get; set; }
    }

    private sealed class AccountHistoryRow
    {
        public DateTime Date { get; set; }
        public decimal PositionValue { get; set; }
        public decimal TotalAssets { get; set; }
        public decimal NetInflow { get; set; }
        public decimal AvailableFunds { get; set; }
    }

    private sealed class AccountHistoryColumnLayout
    {
        public float DateRightBoundary { get; set; }
        public float FeeRightBoundary { get; set; }
        public float PositionValueRightBoundary { get; set; }
        public float TotalAssetsRightBoundary { get; set; }
        public float NetInflowRightBoundary { get; set; }
    }

    private sealed class CompositeImportParseResult
    {
        public DateTime? RecognizedDate { get; set; }
        public PortfolioAccountImportResponse? Account { get; set; }
        public PortfolioBankFlowImportResponse? BankFlow { get; set; }
        public List<PortfolioPositionImportResponse> Positions { get; set; } = [];
    }

    private sealed class FlowColumnLayout
    {
        public float NameRightBoundary { get; set; }
        public float DailyPnLCenter { get; set; }
        public float DailyPnLRatioCenter { get; set; }
        public float PositionQuantityCenter { get; set; }
        public float BuyQuantityCenter { get; set; }
        public float SellQuantityCenter { get; set; }
        public float BuyPriceCenter { get; set; }
        public float SellPriceCenter { get; set; }
        public float ClosePriceCenter { get; set; }
        public float DailyPnLRightBoundary { get; set; }
        public float DailyPnLRatioRightBoundary { get; set; }
        public float PositionQuantityRightBoundary { get; set; }
        public float BuyQuantityRightBoundary { get; set; }
        public float SellQuantityRightBoundary { get; set; }
        public float BuyPriceRightBoundary { get; set; }
        public float SellPriceRightBoundary { get; set; }
    }

    private sealed class MobileHoldingsColumnLayout
    {
        public float TopNameRightBoundary { get; set; }
        public float MarketValueCenter { get; set; }
        public float PositionPnLCenter { get; set; }
        public float PositionQuantityCenter { get; set; }
        public float CostPriceCenter { get; set; }
        public float DailyPnLCenter { get; set; }
    }

    private sealed class FlowRowText
    {
        public string DailyPnLText { get; set; } = string.Empty;
        public string DailyPnLRatioText { get; set; } = string.Empty;
        public string PositionQuantityText { get; set; } = string.Empty;
        public string BuyQuantityText { get; set; } = string.Empty;
        public string SellQuantityText { get; set; } = string.Empty;
        public string BuyPriceText { get; set; } = string.Empty;
        public string SellPriceText { get; set; } = string.Empty;
        public string ClosePriceText { get; set; } = string.Empty;
    }

    private sealed class MobileHoldingTopRowText
    {
        public string PositionPnLText { get; set; } = string.Empty;
        public string PositionQuantityText { get; set; } = string.Empty;
        public string CostPriceText { get; set; } = string.Empty;
        public string DailyPnLText { get; set; } = string.Empty;
    }

    private sealed class MobileHoldingBottomRowText
    {
        public string MarketValueText { get; set; } = string.Empty;
        public string CurrentPriceText { get; set; } = string.Empty;
    }

    private sealed class DetailDateCandidate
    {
        public string RawText { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
        public int Score { get; set; }
        public float Top { get; set; }
    }

    private sealed class ImageSnapshotMetadata
    {
        public int Width { get; set; }
        public int Height { get; set; }
        public float AspectRatio => Height <= 0 ? 0 : (float)Width / Height;
    }

    private readonly record struct HeaderMatchCandidate
    {
        public int Priority { get; init; }
        public double Score { get; init; }
        public float Center { get; init; }
    }
}
