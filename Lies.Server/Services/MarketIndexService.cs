using System.Globalization;
using System.Text.Json;

namespace Lies.Server.Services;

public sealed class MarketIndexService : IMarketIndexService
{
    private static readonly MarketIndexDefinition[] Definitions =
    [
        new("shanghai", "上证指数", "sh000001"),
        new("shenzhen", "深证成指", "sz399001"),
        new("chinext", "创业板指数", "sz399006")
    ];

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<MarketIndexService> _logger;

    public MarketIndexService(
        IHttpClientFactory httpClientFactory,
        ILogger<MarketIndexService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<IReadOnlyList<MarketIndexSeries>> GetDailySeriesAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken cancellationToken = default)
    {
        if (endDate.Date < startDate.Date)
        {
            return Array.Empty<MarketIndexSeries>();
        }

        var lookbackDays = Math.Max(240, (int)Math.Ceiling((endDate.Date - startDate.Date).TotalDays * 1.8) + 90);
        var client = _httpClientFactory.CreateClient("MarketIndex");
        var results = new List<MarketIndexSeries>(Definitions.Length);

        foreach (var definition in Definitions)
        {
            try
            {
                var url = $"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={definition.Symbol},day,,,{lookbackDays},qfq";
                var payload = await client.GetStringAsync(url, cancellationToken);
                using var document = JsonDocument.Parse(payload);

                if (!document.RootElement.TryGetProperty("data", out var dataElement)
                    || !dataElement.TryGetProperty(definition.Symbol, out var symbolElement)
                    || !symbolElement.TryGetProperty("day", out var dayElement)
                    || dayElement.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                var bars = new List<MarketIndexDailyBar>();
                foreach (var item in dayElement.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Array)
                    {
                        continue;
                    }

                    var values = item.EnumerateArray()
                        .Select(element => element.GetString() ?? string.Empty)
                        .ToArray();

                    if (values.Length < 3
                        || !DateTime.TryParse(values[0], CultureInfo.InvariantCulture, DateTimeStyles.None, out var tradeDate)
                        || !decimal.TryParse(values[1], NumberStyles.Number, CultureInfo.InvariantCulture, out var open)
                        || !decimal.TryParse(values[2], NumberStyles.Number, CultureInfo.InvariantCulture, out var close))
                    {
                        continue;
                    }

                    bars.Add(new MarketIndexDailyBar
                    {
                        Date = tradeDate.Date,
                        Open = open,
                        Close = close
                    });
                }

                results.Add(new MarketIndexSeries
                {
                    Key = definition.Key,
                    Name = definition.Name,
                    Bars = bars
                        .Where(item => item.Date >= startDate.Date.AddDays(-60) && item.Date <= endDate.Date)
                        .OrderBy(item => item.Date)
                        .ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "获取指数 {IndexName} 行情失败", definition.Name);
            }
        }

        return results;
    }

    private sealed record MarketIndexDefinition(string Key, string Name, string Symbol);
}
