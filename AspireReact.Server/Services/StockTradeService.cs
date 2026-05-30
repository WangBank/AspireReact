using AspireReact.Server.Data;
using AspireReact.Server.DTOs;
using AspireReact.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace AspireReact.Server.Services;

public class StockTradeService : IStockTradeService
{
    private readonly AppDbContext _db;

    public StockTradeService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// 新增交易记录（带验证）
    /// </summary>
    public async Task<StockTradeResult> CreateAsync(StockTradeRequest request)
    {
        // 验证：同一心魔在同一天不应重复录入（防止误操作）
        var exists = await _db.StockTrades.AnyAsync(t =>
            t.TradeDate == request.TradeDate.Date &&
            t.StockCode == request.StockCode);
        if (exists)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"心魔 {request.StockCode} 在 {request.TradeDate:yyyy-MM-dd} 已有交易记录，请勿重复添加"
            };
        }

        var entity = new StockTrade
        {
            TradeDate = request.TradeDate.Date,
            StockCode = request.StockCode,
            StockName = request.StockName,
            Board = ParseBoard(request.Board),
            BuyPrice = request.BuyPrice,
            BuyQuantity = request.BuyQuantity,
            SellPrice = request.SellPrice,
            SellQuantity = request.SellQuantity,
            PositionPnL = request.PositionPnL,
            CumulativePnL = request.CumulativePnL,
            CostPrice = request.CostPrice,
            CurrentPrice = request.CurrentPrice,
            PositionQuantity = request.PositionQuantity,
            DailyPnL = request.DailyPnL,
            IsLiquidated = request.IsLiquidated,
            TradeNote = request.TradeNote,
            TonghuashunLink = request.TonghuashunLink
        };

        _db.StockTrades.Add(entity);
        await _db.SaveChangesAsync();

        return new StockTradeResult
        {
            Success = true,
            Message = "交易记录添加成功",
            Data = await BuildCorrectedResponseAsync(entity.Id) ?? ToResponse(entity)
        };
    }

    /// <summary>
    /// 批量新增交易记录
    /// </summary>
    public async Task<BatchStockTradeResult> BatchCreateAsync(BatchStockTradeRequest request)
    {
        var results = new List<StockTradeResponse>();
        var errors = new List<string>();
        int successCount = 0;
        int failCount = 0;

        foreach (var tradeRequest in request.Trades)
        {
            // 验证：同一心魔在同一天不应重复录入
            var exists = await _db.StockTrades.AnyAsync(t =>
                t.TradeDate == tradeRequest.TradeDate.Date &&
                t.StockCode == tradeRequest.StockCode);
            if (exists)
            {
                failCount++;
                errors.Add($"心魔 {tradeRequest.StockCode} 在 {tradeRequest.TradeDate:yyyy-MM-dd} 已有交易记录，已跳过");
                continue;
            }

            var entity = new StockTrade
            {
                TradeDate = tradeRequest.TradeDate.Date,
                StockCode = tradeRequest.StockCode,
                StockName = tradeRequest.StockName,
                Board = ParseBoard(tradeRequest.Board),
                BuyPrice = tradeRequest.BuyPrice,
                BuyQuantity = tradeRequest.BuyQuantity,
                SellPrice = tradeRequest.SellPrice,
                SellQuantity = tradeRequest.SellQuantity,
                PositionPnL = tradeRequest.PositionPnL,
                CumulativePnL = tradeRequest.CumulativePnL,
                CostPrice = tradeRequest.CostPrice,
                CurrentPrice = tradeRequest.CurrentPrice,
                PositionQuantity = tradeRequest.PositionQuantity,
                DailyPnL = tradeRequest.DailyPnL,
                IsLiquidated = tradeRequest.IsLiquidated,
                TradeNote = tradeRequest.TradeNote,
                TonghuashunLink = tradeRequest.TonghuashunLink
            };

            _db.StockTrades.Add(entity);
            results.Add(ToResponse(entity));
            successCount++;
        }

        if (successCount > 0)
        {
            await _db.SaveChangesAsync();
        }

        var total = successCount + failCount;
        return new BatchStockTradeResult
        {
            Success = successCount > 0,
            Message = $"批量录入完成：成功 {successCount} 条，跳过 {failCount} 条（共 {total} 条）",
            SuccessCount = successCount,
            FailCount = failCount,
            Data = results,
            Errors = errors.Count > 0 ? errors : null
        };
    }

    /// <summary>
    /// 修改交易记录
    /// </summary>
    public async Task<StockTradeResult> UpdateAsync(int id, StockTradeRequest request)
    {
        var entity = await _db.StockTrades.FindAsync(id);
        if (entity == null)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的交易记录"
            };
        }

        // 如果修改了日期或心魔代码，检查是否与其他记录冲突
        if (entity.TradeDate != request.TradeDate.Date || entity.StockCode != request.StockCode)
        {
            var conflict = await _db.StockTrades.AnyAsync(t =>
                t.Id != id &&
                t.TradeDate == request.TradeDate.Date &&
                t.StockCode == request.StockCode);
            if (conflict)
            {
                return new StockTradeResult
                {
                    Success = false,
                    Message = $"心魔 {request.StockCode} 在 {request.TradeDate:yyyy-MM-dd} 已有其他交易记录，无法修改为该组合"
                };
            }
        }

        entity.TradeDate = request.TradeDate.Date;
        entity.StockCode = request.StockCode;
        entity.StockName = request.StockName;
        entity.Board = ParseBoard(request.Board);
        entity.BuyPrice = request.BuyPrice;
        entity.BuyQuantity = request.BuyQuantity;
        entity.SellPrice = request.SellPrice;
        entity.SellQuantity = request.SellQuantity;
        entity.PositionPnL = request.PositionPnL;
        entity.CumulativePnL = request.CumulativePnL;
        entity.CostPrice = request.CostPrice;
        entity.CurrentPrice = request.CurrentPrice;
        entity.PositionQuantity = request.PositionQuantity;
        entity.DailyPnL = request.DailyPnL;
        entity.IsLiquidated = request.IsLiquidated;
        entity.TradeNote = request.TradeNote;
        entity.TonghuashunLink = request.TonghuashunLink;

        await _db.SaveChangesAsync();

        return new StockTradeResult
        {
            Success = true,
            Message = "交易记录修改成功",
            Data = await BuildCorrectedResponseAsync(entity.Id) ?? ToResponse(entity)
        };
    }

    /// <summary>
    /// 批量修改交易记录
    /// </summary>
    public async Task<BatchStockTradeResult> BatchUpdateAsync(BatchTradeUpdateRequest request)
    {
        var results = new List<StockTradeResponse>();
        var errors = new List<string>();
        int successCount = 0;
        int failCount = 0;

        foreach (var item in request.Trades)
        {
            var entity = await _db.StockTrades.FindAsync(item.Id);
            if (entity == null)
            {
                failCount++;
                errors.Add($"未找到 ID 为 {item.Id} 的交易记录，已跳过");
                continue;
            }

            var req = item.Data;
            // 如果修改了日期或心魔代码，检查是否与其他记录冲突
            if (entity.TradeDate != req.TradeDate.Date || entity.StockCode != req.StockCode)
            {
                var conflict = await _db.StockTrades.AnyAsync(t =>
                    t.Id != item.Id &&
                    t.TradeDate == req.TradeDate.Date &&
                    t.StockCode == req.StockCode);
                if (conflict)
                {
                    failCount++;
                    errors.Add($"心魔 {req.StockCode} 在 {req.TradeDate:yyyy-MM-dd} 已有其他记录，跳过 ID {item.Id}");
                    continue;
                }
            }

            entity.TradeDate = req.TradeDate.Date;
            entity.StockCode = req.StockCode;
            entity.StockName = req.StockName;
            entity.Board = ParseBoard(req.Board);
            entity.BuyPrice = req.BuyPrice;
            entity.BuyQuantity = req.BuyQuantity;
            entity.SellPrice = req.SellPrice;
            entity.SellQuantity = req.SellQuantity;
            entity.PositionPnL = req.PositionPnL;
            entity.CumulativePnL = req.CumulativePnL;
            entity.CostPrice = req.CostPrice;
            entity.CurrentPrice = req.CurrentPrice;
            entity.PositionQuantity = req.PositionQuantity;
            entity.DailyPnL = req.DailyPnL;
            entity.IsLiquidated = req.IsLiquidated;
            entity.TradeNote = req.TradeNote;
            entity.TonghuashunLink = req.TonghuashunLink;

            results.Add(ToResponse(entity));
            successCount++;
        }

        if (successCount > 0)
        {
            await _db.SaveChangesAsync();
        }

        return new BatchStockTradeResult
        {
            Success = successCount > 0,
            Message = $"批量修改完成：成功 {successCount} 条，失败 {failCount} 条",
            SuccessCount = successCount,
            FailCount = failCount,
            Data = results,
            Errors = errors.Count > 0 ? errors : null
        };
    }

    /// <summary>
    /// 删除交易记录
    /// </summary>
    public async Task<StockTradeResult> DeleteAsync(int id)
    {
        var entity = await _db.StockTrades.FindAsync(id);
        if (entity == null)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的交易记录"
            };
        }

        _db.StockTrades.Remove(entity);
        await _db.SaveChangesAsync();

        return new StockTradeResult
        {
            Success = true,
            Message = "交易记录删除成功"
        };
    }

    /// <summary>
    /// 单条详情
    /// </summary>
    public async Task<StockTradeResult> GetByIdAsync(int id)
    {
        var response = await BuildCorrectedResponseAsync(id);
        if (response == null)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的交易记录"
            };
        }

        return new StockTradeResult
        {
            Success = true,
            Message = "查询成功",
            Data = response
        };
    }

    /// <summary>
    /// 多条件筛选查询（分页）
    /// </summary>
    public async Task<PagedResult<StockTradeResponse>> QueryAsync(TradeQueryRequest request)
    {
        var historyQuery = _db.StockTrades.AsNoTracking();
        DateTime? start = null;
        DateTime? end = null;

        // 按心魔代码筛选
        if (!string.IsNullOrWhiteSpace(request.StockCode))
        {
            var code = request.StockCode.Trim();
            historyQuery = historyQuery.Where(t => t.StockCode.Contains(code));
        }

        // 按交易日期范围筛选
        if (request.TradeDateStart.HasValue)
        {
            start = request.TradeDateStart.Value.Date;
        }

        if (request.TradeDateEnd.HasValue)
        {
            end = request.TradeDateEnd.Value.Date;
            historyQuery = historyQuery.Where(t => t.TradeDate <= end);
        }

        // 按板块筛选
        if (!string.IsNullOrWhiteSpace(request.Board))
        {
            var board = ParseBoard(request.Board);
            historyQuery = historyQuery.Where(t => t.Board == board);
        }

        var correctedRecords = await BuildCorrectedSnapshotsAsync(historyQuery);
        var filteredRecords = correctedRecords
            .Where(snapshot => IsWithinRange(snapshot.Trade.TradeDate, start, end))
            .OrderByDescending(snapshot => snapshot.Trade.TradeDate)
            .ThenBy(snapshot => snapshot.Trade.StockCode)
            .ThenByDescending(snapshot => snapshot.Trade.Id)
            .ToList();

        var total = filteredRecords.Count;

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 5000);
        var items = filteredRecords
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToResponse)
            .ToList();

        return new PagedResult<StockTradeResponse>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    /// <summary>
    /// 统计汇总（按日期范围、心魔、板块统计盈亏）
    /// </summary>
    public async Task<TradeSummaryResponse> GetSummaryAsync(TradeSummaryRequest request)
    {
        var historyQuery = _db.StockTrades.AsNoTracking();
        var bankFlowQuery = _db.BankFlows.AsNoTracking();
        DateTime? start = null;
        DateTime? end = null;

        // 按日期范围过滤
        if (request.StartDate.HasValue)
        {
            start = request.StartDate.Value.Date;
            bankFlowQuery = bankFlowQuery.Where(flow => flow.Date >= start);
        }

        if (request.EndDate.HasValue)
        {
            end = request.EndDate.Value.Date;
            historyQuery = historyQuery.Where(t => t.TradeDate <= end);
            bankFlowQuery = bankFlowQuery.Where(flow => flow.Date <= end);
        }

        // 按心魔过滤
        if (!string.IsNullOrWhiteSpace(request.StockCode))
        {
            var code = request.StockCode.Trim();
            historyQuery = historyQuery.Where(t => t.StockCode == code);
        }

        // 按板块过滤
        if (!string.IsNullOrWhiteSpace(request.Board))
        {
            var board = ParseBoard(request.Board);
            historyQuery = historyQuery.Where(t => t.Board == board);
        }

        var correctedRecords = await BuildCorrectedSnapshotsAsync(historyQuery);
        var rangeRecords = correctedRecords
            .Where(snapshot => IsWithinRange(snapshot.Trade.TradeDate, start, end))
            .ToList();
        var bankFlowRecords = await bankFlowQuery.ToListAsync();

        var stockAggregates = correctedRecords
            .GroupBy(snapshot => new { snapshot.Trade.StockCode, snapshot.Trade.StockName, snapshot.Trade.Board })
            .Select(g =>
            {
                var ordered = g
                    .OrderBy(snapshot => snapshot.Trade.TradeDate)
                    .ThenBy(snapshot => snapshot.Trade.Id)
                    .ToList();
                var inRange = ordered
                    .Where(snapshot => IsWithinRange(snapshot.Trade.TradeDate, start, end))
                    .ToList();

                if (inRange.Count == 0)
                {
                    return null;
                }

                var pnlContributions = BuildPnLContributions(ordered, start, end);
                var latestRecord = inRange[^1];
                var latestOpenPosition = TradeMetricsCalculator.IsHoldingClosed(latestRecord.Trade)
                    ? null
                    : latestRecord;
                var winCount = pnlContributions.Count(value => value > 0);
                var loseCount = pnlContributions.Count(value => value < 0);

                return new StockAggregate
                {
                    StockCode = g.Key.StockCode,
                    StockName = g.Key.StockName,
                    Board = g.Key.Board,
                    TradeCount = pnlContributions.Count,
                    TotalPositionPnL = latestOpenPosition?.PositionPnL ?? 0,
                    TotalCumulativePnL = inRange.Sum(snapshot => snapshot.Trade.DailyPnL),
                    WinCount = winCount,
                    LoseCount = loseCount
                };
            })
            .Where(item => item != null)
            .Select(item => item!)
            .ToList();

        var byStock = stockAggregates
            .Select(item => new TradeSummaryItem
            {
                StockCode = item.StockCode,
                StockName = item.StockName,
                Board = item.Board.ToString(),
                TradeCount = item.TradeCount,
                TotalPositionPnL = item.TotalPositionPnL,
                TotalCumulativePnL = item.TotalCumulativePnL,
                WinRate = (item.WinCount + item.LoseCount) > 0
                    ? (decimal)item.WinCount / (item.WinCount + item.LoseCount)
                    : 0
            })
            .OrderByDescending(x => x.TotalCumulativePnL)
            .ToList();

        var byBoard = stockAggregates
            .GroupBy(t => t.Board)
            .Select(g =>
            {
                return new TradeSummaryItem
                {
                    StockCode = "—",
                    StockName = g.Key.ToString(),
                    Board = g.Key.ToString(),
                    TradeCount = g.Sum(item => item.TradeCount),
                    TotalPositionPnL = g.Sum(item => item.TotalPositionPnL),
                    TotalCumulativePnL = g.Sum(item => item.TotalCumulativePnL),
                    WinRate = (g.Sum(item => item.WinCount) + g.Sum(item => item.LoseCount)) > 0
                        ? (decimal)g.Sum(item => item.WinCount) /
                          (g.Sum(item => item.WinCount) + g.Sum(item => item.LoseCount))
                        : 0
                };
            })
            .OrderByDescending(x => x.TotalCumulativePnL)
            .ToList();

        var totalPnL = stockAggregates.Sum(item => item.TotalCumulativePnL);

        var totalTrades = stockAggregates.Sum(item => item.TradeCount);
        var winRecords = stockAggregates.Sum(item => item.WinCount);
        var loseRecords = stockAggregates.Sum(item => item.LoseCount);
        var overallWinRate = (winRecords + loseRecords) > 0
            ? (decimal)winRecords / (winRecords + loseRecords)
            : 0;

        var latestRecordsByStock = rangeRecords
            .GroupBy(snapshot => new { snapshot.Trade.StockCode, snapshot.Trade.StockName, snapshot.Trade.Board })
            .Select(g => g
                .OrderBy(snapshot => snapshot.Trade.TradeDate)
                .ThenBy(snapshot => snapshot.Trade.Id)
                .Last())
            .ToList();

        var positionOnlyRecords = latestRecordsByStock
            .Where(p => p != null)
            .Where(p => !TradeMetricsCalculator.IsHoldingClosed(p.Trade))
            .Select(p => new PositionSummaryItem
            {
                StockCode = p.Trade.StockCode,
                StockName = p.Trade.StockName,
                Board = p.Trade.Board.ToString(),
                PositionQuantity = p.Trade.PositionQuantity,
                CostPrice = TradeMetricsCalculator.CalculateCostPrice(p),
                CurrentPrice = p.Trade.CurrentPrice,
                PositionPnL = p.PositionPnL,
                DailyPnL = p.Trade.DailyPnL,
                LastUpdateDate = p.Trade.TradeDate
            })
            .OrderByDescending(p => p.PositionPnL)
            .ToList();

        var totalPositionValue = positionOnlyRecords.Sum(p => p.CurrentPrice * p.PositionQuantity);
        var totalPositionPnL = positionOnlyRecords.Sum(p => p.PositionPnL);
        var totalDailyPnL = latestRecordsByStock.Sum(p => p.Trade.DailyPnL);
        var totalBankInflow = bankFlowRecords
            .Where(flow => string.Equals(flow.FlowType, "转入", StringComparison.Ordinal))
            .Sum(flow => flow.Amount);
        var totalBankOutflow = bankFlowRecords
            .Where(flow => string.Equals(flow.FlowType, "转出", StringComparison.Ordinal))
            .Sum(flow => flow.Amount);
        var currentTotalAmount = await _db.AccountDailies
            .AsNoTracking()
            .OrderByDescending(item => item.Date)
            .Select(item => (decimal?)item.TotalAssets)
            .FirstOrDefaultAsync() ?? 0;

        return new TradeSummaryResponse
        {
            TotalTrades = totalTrades,
            TotalPnL = totalPnL,
            NetBankFlow = totalBankInflow - totalBankOutflow,
            TotalBankInflow = totalBankInflow,
            TotalBankOutflow = totalBankOutflow,
            CurrentTotalAmount = currentTotalAmount,
            WinTrades = winRecords,
            LoseTrades = loseRecords,
            OverallWinRate = overallWinRate,
            ByStock = byStock,
            ByBoard = byBoard,
            PositionCount = positionOnlyRecords.Count,
            TotalPositionValue = totalPositionValue,
            TotalPositionPnL = totalPositionPnL,
            TotalDailyPnL = totalDailyPnL,
            Positions = positionOnlyRecords
        };
    }

    // ──────────────────────────────────────────────
    // 私有辅助方法
    // ──────────────────────────────────────────────

    private static TradeBoard ParseBoard(string board)
    {
        return board switch
        {
            "主板" => TradeBoard.主板,
            "创业板" => TradeBoard.创业板,
            "科创板" => TradeBoard.科创板,
            "北交所" => TradeBoard.北交所,
            _ => Enum.TryParse<TradeBoard>(board, out var result) ? result : TradeBoard.主板
        };
    }

    private static List<decimal> BuildPnLContributions(
        IReadOnlyList<TradeMetricSnapshot> orderedRecords,
        DateTime? startDate,
        DateTime? endDate)
    {
        var contributions = new List<decimal>();
        var segmentPnL = 0m;
        var hasRangeRecord = false;

        foreach (var record in orderedRecords)
        {
            if (IsWithinRange(record.Trade.TradeDate, startDate, endDate))
            {
                segmentPnL += record.Trade.DailyPnL;
                hasRangeRecord = true;
            }

            if (ClosesHoldingCycle(record.Trade) && hasRangeRecord)
            {
                contributions.Add(segmentPnL);
                segmentPnL = 0;
                hasRangeRecord = false;
            }
        }

        if (hasRangeRecord)
        {
            contributions.Add(segmentPnL);
        }

        return contributions;
    }

    private async Task<List<TradeMetricSnapshot>> BuildCorrectedSnapshotsAsync(IQueryable<StockTrade> query)
    {
        var historyRecords = await query
            .OrderBy(trade => trade.TradeDate)
            .ThenBy(trade => trade.Id)
            .ToListAsync();

        return TradeMetricsCalculator.Recalculate(historyRecords).ToList();
    }

    private static bool ClosesHoldingCycle(StockTrade trade)
    {
        return TradeMetricsCalculator.IsHoldingClosed(trade);
    }

    private async Task<StockTradeResponse?> BuildCorrectedResponseAsync(int id)
    {
        var entity = await _db.StockTrades
            .AsNoTracking()
            .FirstOrDefaultAsync(trade => trade.Id == id);

        if (entity == null)
        {
            return null;
        }

        var correctedSnapshots = await BuildCorrectedSnapshotsAsync(
            _db.StockTrades
                .AsNoTracking()
                .Where(trade => trade.StockCode == entity.StockCode)
                .Where(trade => trade.TradeDate < entity.TradeDate
                    || (trade.TradeDate == entity.TradeDate && trade.Id <= entity.Id)));

        var snapshot = correctedSnapshots.LastOrDefault(item => item.Trade.Id == id);
        return snapshot == null ? ToResponse(entity) : ToResponse(snapshot);
    }

    private static bool IsWithinRange(DateTime date, DateTime? startDate, DateTime? endDate)
    {
        var target = date.Date;
        if (startDate.HasValue && target < startDate.Value.Date)
        {
            return false;
        }

        if (endDate.HasValue && target > endDate.Value.Date)
        {
            return false;
        }

        return true;
    }

    private sealed class StockAggregate
    {
        public string StockCode { get; init; } = string.Empty;
        public string StockName { get; init; } = string.Empty;
        public TradeBoard Board { get; init; }
        public int TradeCount { get; init; }
        public decimal TotalPositionPnL { get; init; }
        public decimal TotalCumulativePnL { get; init; }
        public int WinCount { get; init; }
        public int LoseCount { get; init; }
    }

    private static StockTradeResponse ToResponse(StockTrade entity)
    {
        return new StockTradeResponse
        {
            Id = entity.Id,
            TradeDate = entity.TradeDate,
            StockCode = entity.StockCode,
            StockName = entity.StockName,
            Board = entity.Board.ToString(),
            BuyPrice = entity.BuyPrice,
            BuyQuantity = entity.BuyQuantity,
            SellPrice = entity.SellPrice,
            SellQuantity = entity.SellQuantity,
            PositionPnL = entity.PositionPnL,
            CumulativePnL = entity.CumulativePnL,
            CostPrice = entity.CostPrice,
            CurrentPrice = entity.CurrentPrice,
            PositionQuantity = entity.PositionQuantity,
            DailyPnL = entity.DailyPnL,
            IsLiquidated = entity.IsLiquidated,
            TradeNote = entity.TradeNote,
            TonghuashunLink = entity.TonghuashunLink
        };
    }

    private static StockTradeResponse ToResponse(TradeMetricSnapshot snapshot)
    {
        var entity = snapshot.Trade;
        return new StockTradeResponse
        {
            Id = entity.Id,
            TradeDate = entity.TradeDate,
            StockCode = entity.StockCode,
            StockName = entity.StockName,
            Board = entity.Board.ToString(),
            BuyPrice = entity.BuyPrice,
            BuyQuantity = entity.BuyQuantity,
            SellPrice = entity.SellPrice,
            SellQuantity = entity.SellQuantity,
            PositionPnL = snapshot.PositionPnL,
            CumulativePnL = snapshot.CumulativePnL,
            CostPrice = TradeMetricsCalculator.CalculateCostPrice(snapshot),
            CurrentPrice = entity.CurrentPrice,
            PositionQuantity = entity.PositionQuantity,
            DailyPnL = entity.DailyPnL,
            IsLiquidated = entity.IsLiquidated,
            TradeNote = entity.TradeNote,
            TonghuashunLink = entity.TonghuashunLink
        };
    }
}
