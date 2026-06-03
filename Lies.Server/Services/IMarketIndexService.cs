namespace Lies.Server.Services;

public interface IMarketIndexService
{
    Task<IReadOnlyList<MarketIndexSeries>> GetDailySeriesAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken cancellationToken = default);
}

public sealed class MarketIndexSeries
{
    public string Key { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public IReadOnlyList<MarketIndexDailyBar> Bars { get; init; } = Array.Empty<MarketIndexDailyBar>();
}

public sealed class MarketIndexDailyBar
{
    public DateTime Date { get; init; }
    public decimal Open { get; init; }
    public decimal Close { get; init; }
}
