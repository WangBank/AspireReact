using System.Globalization;
using System.Text.RegularExpressions;
using AspireReact.Server.DTOs;
using AspireReact.Server.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RapidOCRSharpOnnx;
using RapidOCRSharpOnnx.Configurations;
using RapidOCRSharpOnnx.Inference.PPOCR_Det.Models;
using RapidOCRSharpOnnx.Providers;
using RapidOCRSharpOnnx.Utils;

namespace AspireReact.Server.Services;

public class PortfolioScreenshotImportService : IPortfolioScreenshotImportService
{
    private readonly IStockSearchService _stockSearchService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IWebHostEnvironment _environment;
    private readonly RapidOcrOptions _options;
    private readonly ILogger<PortfolioScreenshotImportService> _logger;

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

    public PortfolioScreenshotImportService(
        IStockSearchService stockSearchService,
        IHttpClientFactory httpClientFactory,
        IWebHostEnvironment environment,
        IOptions<RapidOcrOptions> options,
        ILogger<PortfolioScreenshotImportService> logger)
    {
        _stockSearchService = stockSearchService;
        _httpClientFactory = httpClientFactory;
        _environment = environment;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<PortfolioScreenshotImportResult> ParseAsync(
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

        try
        {
            await SaveToTempFileAsync(request.Image, tempFilePath, cancellationToken);

            var modelPaths = await EnsureModelPathsAsync(cancellationToken);
            using var ocr = CreateOcrEngine(modelPaths);
            var ocrResult = ocr.RecognizeText(tempFilePath);
            var tokens = BuildTokens(ocrResult);

            if (tokens.Count == 0)
            {
                return new PortfolioScreenshotImportResult
                {
                    Success = false,
                    StatusCode = StatusCodes.Status422UnprocessableEntity,
                    Message = "图片中未识别到有效文字，请换一张更清晰的持仓截图重试"
                };
            }

            var warnings = new List<string>();
            var account = ParseAccount(tokens, warnings);
            var positions = await ParsePositionsAsync(tokens, warnings, cancellationToken);

            return new PortfolioScreenshotImportResult
            {
                Success = true,
                Message = $"识别完成：账户字段 {(account == null ? 0 : 4)} 项，持仓 {positions.Count} 条",
                Data = new PortfolioScreenshotImportResponse
                {
                    Account = account,
                    Positions = positions,
                    Warnings = warnings.Distinct().ToList()
                }
            };
        }
        catch (Exception ex) when (IsNativeRuntimeException(ex))
        {
            _logger.LogError(ex, "RapidOCR 原生依赖加载失败");
            return new PortfolioScreenshotImportResult
            {
                Success = false,
                StatusCode = StatusCodes.Status503ServiceUnavailable,
                Message = "RapidOCR 本地依赖加载失败，请确认 ONNX Runtime 与 OpenCvSharp 原生运行时已正确安装"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "解析券商持仓截图失败");
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

    private async Task SaveToTempFileAsync(IFormFile file, string tempFilePath, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        await using var output = File.Create(tempFilePath);
        await stream.CopyToAsync(output, cancellationToken);
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
        var config = !string.IsNullOrWhiteSpace(fontPath)
            ? new OcrConfig(modelPaths.DetectorPath, modelPaths.RecognizerPath, fontPath, OCRVersion.PPOCRV5, modelPaths.ClassifierPath)
            : new OcrConfig(modelPaths.DetectorPath, modelPaths.RecognizerPath, LangRec.CH, OCRVersion.PPOCRV5, modelPaths.ClassifierPath);

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

    private static string? ResolveFontPath()
    {
        var candidates = new[]
        {
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "/System/Library/Fonts/STHeiti Medium.ttc",
            @"C:\Windows\Fonts\msyh.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"
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

    private static PortfolioAccountImportResponse? ParseAccount(List<OcrToken> tokens, List<string> warnings)
    {
        var totalAssets = FindValueBelow(tokens, ["总资产"]);
        var positionValue = FindValueBelow(tokens, ["股票市值", "持仓市值", "总市值"]);
        var availableFunds = FindValueBelow(tokens, ["可用金额", "可用资金", "可用"]);
        var dailyPnL = FindValueBelow(tokens, ["当日参考盈亏", "当日盈亏"]);

        if (totalAssets == null && positionValue == null && availableFunds == null && dailyPnL == null)
        {
            warnings.Add("未识别到账户汇总数据，请确认截图中包含总资产和当日盈亏区域。");
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
        return NumberRegex.IsMatch(text);
    }

    private static bool TryParseNumber(string text, out decimal value)
    {
        value = 0;
        var match = NumberRegex.Match(text);
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
}
