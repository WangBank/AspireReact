using Lies.Server.Entities;

namespace Lies.Server.Services;

internal static class TradeMetricsCalculator
{
    public static IReadOnlyList<TradeMetricSnapshot> Recalculate(IEnumerable<StockTrade> trades)
    {
        var snapshots = new List<TradeMetricSnapshot>();

        foreach (var group in trades.GroupBy(GetStockIdentity, StringComparer.Ordinal))
        {
            var orderedTrades = group
                .OrderBy(trade => trade.TradeDate)
                .ThenBy(trade => trade.Id)
                .ToList();

            snapshots.AddRange(RecalculateSingleStock(orderedTrades));
        }

        return snapshots;
    }

    public static bool IsHoldingClosed(StockTrade trade)
    {
        return trade.IsLiquidated || trade.PositionQuantity <= 0;
    }

    public static decimal CalculateCostPrice(TradeMetricSnapshot snapshot)
    {
        return CalculateCostPrice(snapshot.Trade, snapshot.PositionPnL);
    }

    public static decimal CalculateCostPrice(StockTrade trade, decimal positionPnL)
    {
        if (trade.PositionQuantity <= 0 || trade.CurrentPrice <= 0)
        {
            return trade.CostPrice;
        }

        var costPrice = trade.CurrentPrice - (positionPnL / trade.PositionQuantity);
        return decimal.Round(costPrice, 3, MidpointRounding.AwayFromZero);
    }

    private static IEnumerable<TradeMetricSnapshot> RecalculateSingleStock(IReadOnlyList<StockTrade> orderedTrades)
    {
        if (orderedTrades.Count == 0)
        {
            yield break;
        }

        StockTrade? previousTrade = null;
        decimal? previousCorrectedCumulative = null;
        decimal cycleBaselineCumulative = 0;

        foreach (var trade in orderedTrades)
        {
            var correctedCumulativePnL = previousCorrectedCumulative.HasValue
                ? previousCorrectedCumulative.Value + trade.DailyPnL
                : ResolveInitialCumulativePnL(trade);

            decimal correctedPositionPnL;
            if (previousTrade == null)
            {
                correctedPositionPnL = ResolveInitialPositionPnL(trade, correctedCumulativePnL);
                cycleBaselineCumulative = correctedCumulativePnL - correctedPositionPnL;
            }
            else
            {
                if (IsHoldingClosed(previousTrade))
                {
                    cycleBaselineCumulative = previousCorrectedCumulative!.Value;
                }

                correctedPositionPnL = correctedCumulativePnL - cycleBaselineCumulative;
            }

            yield return new TradeMetricSnapshot(trade, correctedPositionPnL, correctedCumulativePnL);

            previousTrade = trade;
            previousCorrectedCumulative = correctedCumulativePnL;
        }
    }

    private static decimal ResolveInitialCumulativePnL(StockTrade trade)
    {
        if (trade.CumulativePnL != 0)
        {
            return trade.CumulativePnL;
        }

        if (trade.PositionPnL != 0)
        {
            return trade.PositionPnL;
        }

        return trade.DailyPnL;
    }

    private static decimal ResolveInitialPositionPnL(StockTrade trade, decimal correctedCumulativePnL)
    {
        if (trade.PositionPnL != 0)
        {
            return trade.PositionPnL;
        }

        if (!IsHoldingClosed(trade) && trade.CumulativePnL != 0)
        {
            return correctedCumulativePnL;
        }

        return trade.DailyPnL;
    }

    private static string GetStockIdentity(StockTrade trade)
    {
        return !string.IsNullOrWhiteSpace(trade.StockCode)
            ? trade.StockCode
            : trade.StockName;
    }
}

internal sealed record TradeMetricSnapshot(
    StockTrade Trade,
    decimal PositionPnL,
    decimal CumulativePnL);
