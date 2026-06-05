using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Services;

public class StockTradeService : IStockTradeService
{
    private readonly AppDbContext _db;
    private readonly ISensitiveWordService _sensitiveWordService;

    public StockTradeService(AppDbContext db, ISensitiveWordService sensitiveWordService)
    {
        _db = db;
        _sensitiveWordService = sensitiveWordService;
    }

    private IQueryable<StockTrade> UserTradesQuery(int userId)
    {
        return _db.StockTrades.Where(item => item.UserId == userId);
    }

    private IQueryable<BankFlow> UserBankFlowsQuery(int userId)
    {
        return _db.BankFlows.Where(item => item.UserId == userId);
    }

    private IQueryable<AccountDaily> UserAccountsQuery(int userId)
    {
        return _db.AccountDailies.Where(item => item.UserId == userId);
    }

    private Task<SensitiveWordValidationResult> ValidateTradeTextAsync(StockTradeRequest request)
    {
        var inputs = new List<SensitiveWordInput>
        {
            new("卖出原因", request.SellReason),
            new("交易备注", request.TradeNote)
        };

        if (request.EmotionTags is { Count: > 0 })
        {
            inputs.AddRange(request.EmotionTags.Select(tag => new SensitiveWordInput("情绪标签", tag)));
        }

        if (request.TradeTags is { Count: > 0 })
        {
            inputs.AddRange(request.TradeTags.Select(tag => new SensitiveWordInput("交易标签", tag)));
        }

        return _sensitiveWordService.ValidateAsync(inputs);
    }

    /// <summary>
    /// 新增交易记录（带验证）
    /// </summary>
    public async Task<StockTradeResult> CreateAsync(int userId, StockTradeRequest request)
    {
        var validation = await ValidateTradeTextAsync(request);
        if (!validation.IsValid)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = validation.Message,
                ErrorCode = "validation"
            };
        }

        // 验证：同一心魔在同一天不应重复录入（防止误操作）
        var exists = await UserTradesQuery(userId).AnyAsync(t =>
            t.TradeDate == request.TradeDate.Date &&
            t.StockCode == request.StockCode);
        if (exists)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"心魔 {request.StockCode} 在 {request.TradeDate:yyyy-MM-dd} 已有交易记录，请勿重复添加",
                ErrorCode = "conflict"
            };
        }

        var entity = new StockTrade
        {
            UserId = userId,
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
            SellReason = request.SellReason?.Trim(),
            EmotionTags = NormalizeEmotionTags(request.EmotionTags),
            TradeTags = NormalizeTradeTags(request.TradeTags),
            TradeNote = request.TradeNote,
            TonghuashunLink = request.TonghuashunLink
        };

        _db.StockTrades.Add(entity);
        await _db.SaveChangesAsync();

        return new StockTradeResult
        {
            Success = true,
            Message = "交易记录添加成功",
            Data = await BuildCorrectedResponseAsync(userId, entity.Id) ?? ToResponse(entity)
        };
    }

    /// <summary>
    /// 批量新增交易记录
    /// </summary>
    public async Task<BatchStockTradeResult> BatchCreateAsync(int userId, BatchStockTradeRequest request)
    {
        var results = new List<StockTradeResponse>();
        var errors = new List<string>();
        int successCount = 0;
        int failCount = 0;
        var requestKeys = new HashSet<string>(StringComparer.Ordinal);

        foreach (var tradeRequest in request.Trades)
        {
            var validation = await ValidateTradeTextAsync(tradeRequest);
            if (!validation.IsValid)
            {
                failCount++;
                errors.Add($"心魔 {tradeRequest.StockCode} 在 {tradeRequest.TradeDate:yyyy-MM-dd} 含敏感词，已跳过：{validation.Message}");
                continue;
            }

            var requestKey = BuildTradeRequestKey(tradeRequest.TradeDate, tradeRequest.StockCode);
            if (!requestKeys.Add(requestKey))
            {
                failCount++;
                errors.Add($"心魔 {tradeRequest.StockCode} 在 {tradeRequest.TradeDate:yyyy-MM-dd} 在本次批量录入中重复出现，已跳过");
                continue;
            }

            // 验证：同一心魔在同一天不应重复录入
            var exists = await UserTradesQuery(userId).AnyAsync(t =>
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
                UserId = userId,
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
                SellReason = tradeRequest.SellReason?.Trim(),
                EmotionTags = NormalizeEmotionTags(tradeRequest.EmotionTags),
                TradeTags = NormalizeTradeTags(tradeRequest.TradeTags),
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
    public async Task<StockTradeResult> UpdateAsync(int userId, int id, StockTradeRequest request)
    {
        var validation = await ValidateTradeTextAsync(request);
        if (!validation.IsValid)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = validation.Message,
                ErrorCode = "validation"
            };
        }

        var entity = await UserTradesQuery(userId).FirstOrDefaultAsync(item => item.Id == id);
        if (entity == null)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的交易记录",
                ErrorCode = "not_found"
            };
        }

        // 如果修改了日期或心魔代码，检查是否与其他记录冲突
        if (entity.TradeDate != request.TradeDate.Date || entity.StockCode != request.StockCode)
        {
            var conflict = await UserTradesQuery(userId).AnyAsync(t =>
                t.Id != id &&
                t.TradeDate == request.TradeDate.Date &&
                t.StockCode == request.StockCode);
            if (conflict)
            {
                return new StockTradeResult
                {
                    Success = false,
                    Message = $"心魔 {request.StockCode} 在 {request.TradeDate:yyyy-MM-dd} 已有其他交易记录，无法修改为该组合",
                    ErrorCode = "conflict"
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
        entity.SellReason = request.SellReason?.Trim();
        entity.EmotionTags = NormalizeEmotionTags(request.EmotionTags);
        entity.TradeTags = NormalizeTradeTags(request.TradeTags);
        entity.TradeNote = request.TradeNote;
        entity.TonghuashunLink = request.TonghuashunLink;

        await _db.SaveChangesAsync();

        return new StockTradeResult
        {
            Success = true,
            Message = "交易记录修改成功",
            Data = await BuildCorrectedResponseAsync(userId, entity.Id) ?? ToResponse(entity)
        };
    }

    /// <summary>
    /// 批量修改交易记录
    /// </summary>
    public async Task<BatchStockTradeResult> BatchUpdateAsync(int userId, BatchTradeUpdateRequest request)
    {
        var results = new List<StockTradeResponse>();
        var errors = new List<string>();
        int successCount = 0;
        int failCount = 0;
        var requestKeys = new HashSet<string>(StringComparer.Ordinal);

        foreach (var item in request.Trades)
        {
            var entity = await UserTradesQuery(userId).FirstOrDefaultAsync(trade => trade.Id == item.Id);
            if (entity == null)
            {
                failCount++;
                errors.Add($"未找到 ID 为 {item.Id} 的交易记录，已跳过");
                continue;
            }

            var req = item.Data;
            var validation = await ValidateTradeTextAsync(req);
            if (!validation.IsValid)
            {
                failCount++;
                errors.Add($"心魔 {req.StockCode} 在 {req.TradeDate:yyyy-MM-dd} 含敏感词，跳过 ID {item.Id}：{validation.Message}");
                continue;
            }

            var requestKey = BuildTradeRequestKey(req.TradeDate, req.StockCode);
            if (!requestKeys.Add(requestKey))
            {
                failCount++;
                errors.Add($"心魔 {req.StockCode} 在 {req.TradeDate:yyyy-MM-dd} 在本次批量修改中重复出现，跳过 ID {item.Id}");
                continue;
            }

            // 如果修改了日期或心魔代码，检查是否与其他记录冲突
            if (entity.TradeDate != req.TradeDate.Date || entity.StockCode != req.StockCode)
            {
                var conflict = await UserTradesQuery(userId).AnyAsync(t =>
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
            entity.SellReason = req.SellReason?.Trim();
            entity.EmotionTags = NormalizeEmotionTags(req.EmotionTags);
            entity.TradeTags = NormalizeTradeTags(req.TradeTags);
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
    public async Task<StockTradeResult> DeleteAsync(int userId, int id)
    {
        var entity = await UserTradesQuery(userId).FirstOrDefaultAsync(item => item.Id == id);
        if (entity == null)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的交易记录",
                ErrorCode = "not_found"
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
    public async Task<StockTradeResult> GetByIdAsync(int userId, int id)
    {
        var response = await BuildCorrectedResponseAsync(userId, id);
        if (response == null)
        {
            return new StockTradeResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的交易记录",
                ErrorCode = "not_found"
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
    public async Task<PagedResult<StockTradeResponse>> QueryAsync(int userId, TradeQueryRequest request)
    {
        var historyQuery = UserTradesQuery(userId).AsNoTracking();
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
    public async Task<TradeSummaryResponse> GetSummaryAsync(int userId, TradeSummaryRequest request)
    {
        var historyQuery = UserTradesQuery(userId).AsNoTracking();
        var bankFlowQuery = UserBankFlowsQuery(userId).AsNoTracking();
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
        var bankFlowByDate = bankFlowRecords
            .GroupBy(flow => flow.Date.Date)
            .ToDictionary(
                group => group.Key,
                group => group.Sum(flow => string.Equals(flow.FlowType, "转入", StringComparison.Ordinal)
                    ? flow.Amount
                    : -flow.Amount));
        var accountRecords = await BuildAccountAnalysisRecordsAsync(userId, start, end);

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
                    : 0,
                ContributionRate = 0
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
                        : 0,
                    ContributionRate = 0
                };
            })
            .OrderByDescending(x => x.TotalCumulativePnL)
            .ToList();

        var tradeTotalPnL = stockAggregates.Sum(item => item.TotalCumulativePnL);
        if (tradeTotalPnL != 0)
        {
            foreach (var item in byStock)
            {
                item.ContributionRate = decimal.Round(item.TotalCumulativePnL / tradeTotalPnL, 4, MidpointRounding.AwayFromZero);
            }

            foreach (var item in byBoard)
            {
                item.ContributionRate = decimal.Round(item.TotalCumulativePnL / tradeTotalPnL, 4, MidpointRounding.AwayFromZero);
            }
        }

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

        var openPositionStartDates = BuildOpenPositionStartDates(correctedRecords);
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
                LastUpdateDate = p.Trade.TradeDate,
                OpenDate = openPositionStartDates.TryGetValue(p.Trade.StockCode, out var openDate) ? openDate : null,
                HoldingDays = openPositionStartDates.TryGetValue(p.Trade.StockCode, out var startDateForHolding)
                    ? Math.Max(1, (p.Trade.TradeDate.Date - startDateForHolding.Date).Days + 1)
                    : 0
            })
            .OrderByDescending(p => p.PositionPnL)
            .ToList();

        var dailyPnLHeatmap = BuildDailyPnLHeatmap(accountRecords, rangeRecords, bankFlowByDate);
        var usePortfolioDailyPnL = string.IsNullOrWhiteSpace(request.StockCode)
            && string.IsNullOrWhiteSpace(request.Board)
            && dailyPnLHeatmap.Count > 0;
        var totalPnL = usePortfolioDailyPnL
            ? dailyPnLHeatmap.Sum(item => item.DailyPnL)
            : tradeTotalPnL;
        var totalPositionValue = positionOnlyRecords.Sum(p => p.CurrentPrice * p.PositionQuantity);
        var totalPositionPnL = positionOnlyRecords.Sum(p => p.PositionPnL);
        var realizedPnL = totalPnL - totalPositionPnL;
        var totalDailyPnL = usePortfolioDailyPnL
            ? dailyPnLHeatmap[^1].DailyPnL
            : latestRecordsByStock.Sum(p => p.Trade.DailyPnL);
        var cycleRecords = BuildTradeCycles(correctedRecords, start, end);
        var cycleAnalysis = BuildCycleAnalysisSummary(cycleRecords);
        var cycleDetails = BuildCycleDetails(cycleRecords);
        var dayOutcomes = BuildDayOutcomeSummary(dailyPnLHeatmap);
        var streakAnalysis = BuildStreakAnalysis(dailyPnLHeatmap);
        var dailyWinRates = BuildDailyWinRates(rangeRecords);
        var bestWinRateDay = SelectBestWinRateDay(dailyWinRates);
        var worstWinRateDay = SelectWorstWinRateDay(dailyWinRates);
        var bestProfitInterval = BuildBestProfitInterval(accountRecords, rangeRecords);
        var maxDrawdownInterval = BuildMaxDrawdownInterval(accountRecords, rangeRecords);
        var adjustedReturn = BuildAdjustedReturnSummary(accountRecords, bankFlowRecords);
        var tTradeAnalysis = BuildTTradeAnalysis(rangeRecords);
        var tTradeDetails = BuildTTradeDetails(rangeRecords);
        var capitalAnalysis = BuildCapitalAnalysis(accountRecords);
        var weeklyPnL = BuildPeriodPnLDistribution(dailyPnLHeatmap, PeriodBucketType.Week);
        var monthlyPnL = BuildPeriodPnLDistribution(dailyPnLHeatmap, PeriodBucketType.Month);
        var quarterlyPnL = BuildPeriodPnLDistribution(dailyPnLHeatmap, PeriodBucketType.Quarter);
        var boardRotations = BuildBoardRotations(rangeRecords, totalPnL);
        var bySellReason = BuildTradeBehaviorSummaries(
            rangeRecords.Where(snapshot =>
                !string.IsNullOrWhiteSpace(snapshot.Trade.SellReason)
                && (HasSellOperation(snapshot.Trade) || snapshot.Trade.IsLiquidated)),
            snapshot => new[] { snapshot.Trade.SellReason! });
        var byEmotionTag = BuildTradeBehaviorSummaries(
            rangeRecords.Where(snapshot => !string.IsNullOrWhiteSpace(snapshot.Trade.EmotionTags)),
            snapshot => ParseEmotionTags(snapshot.Trade.EmotionTags));
        var byTradeTag = BuildTradeBehaviorSummaries(
            rangeRecords.Where(snapshot => !string.IsNullOrWhiteSpace(snapshot.Trade.TradeTags)),
            snapshot => ParseTradeTags(snapshot.Trade.TradeTags));
        var totalBankInflow = bankFlowRecords
            .Where(flow => string.Equals(flow.FlowType, "转入", StringComparison.Ordinal))
            .Sum(flow => flow.Amount);
        var totalBankOutflow = bankFlowRecords
            .Where(flow => string.Equals(flow.FlowType, "转出", StringComparison.Ordinal))
            .Sum(flow => flow.Amount);
        var currentTotalAmount = await UserAccountsQuery(userId)
            .AsNoTracking()
            .OrderByDescending(item => item.Date)
            .Select(item => (decimal?)item.TotalAssets)
            .FirstOrDefaultAsync() ?? 0;

        return new TradeSummaryResponse
        {
            TotalTrades = totalTrades,
            TotalPnL = totalPnL,
            RealizedPnL = realizedPnL,
            UnrealizedPnL = totalPositionPnL,
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
            Positions = positionOnlyRecords,
            BySellReason = bySellReason,
            ByEmotionTag = byEmotionTag,
            ByTradeTag = byTradeTag,
            DailyWinRates = dailyWinRates,
            BestWinRateDay = bestWinRateDay,
            WorstWinRateDay = worstWinRateDay,
            BestProfitInterval = bestProfitInterval,
            MaxDrawdownInterval = maxDrawdownInterval,
            AdjustedReturn = adjustedReturn,
            DayOutcomes = dayOutcomes,
            StreakAnalysis = streakAnalysis,
            CycleAnalysis = cycleAnalysis,
            CycleDetails = cycleDetails,
            TTradeAnalysis = tTradeAnalysis,
            TTradeDetails = tTradeDetails,
            CapitalAnalysis = capitalAnalysis,
            DailyPnLHeatmap = dailyPnLHeatmap,
            WeeklyPnL = weeklyPnL,
            MonthlyPnL = monthlyPnL,
            QuarterlyPnL = quarterlyPnL,
            BoardRotations = boardRotations
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

    private static string? NormalizeTradeTags(IEnumerable<string>? tags)
    {
        return NormalizeTagList(tags);
    }

    private static string? NormalizeEmotionTags(IEnumerable<string>? tags)
    {
        return NormalizeTagList(tags);
    }

    private static string? NormalizeTagList(IEnumerable<string>? tags)
    {
        if (tags == null)
        {
            return null;
        }

        var normalized = tags
            .Select(tag => tag?.Trim())
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct(StringComparer.Ordinal)
            .Take(20)
            .ToArray();

        return normalized.Length == 0 ? null : string.Join(",", normalized);
    }

    private static List<string> ParseTradeTags(string? tags)
    {
        return ParseTagList(tags);
    }

    private static List<string> ParseEmotionTags(string? tags)
    {
        return ParseTagList(tags);
    }

    private static List<string> ParseTagList(string? tags)
    {
        if (string.IsNullOrWhiteSpace(tags))
        {
            return new List<string>();
        }

        return tags
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    private static string BuildTradeRequestKey(DateTime tradeDate, string stockCode)
    {
        return $"{tradeDate.Date:yyyy-MM-dd}|{stockCode.Trim()}";
    }

    private static bool HasSellOperation(StockTrade trade)
    {
        return trade.SellPrice > 0 && trade.SellQuantity > 0;
    }

    private static List<TradeBehaviorSummaryItem> BuildTradeBehaviorSummaries(
        IEnumerable<TradeMetricSnapshot> rangeRecords,
        Func<TradeMetricSnapshot, IEnumerable<string>> labelsSelector)
    {
        return rangeRecords
            .SelectMany(snapshot => labelsSelector(snapshot)
                .Select(label => new
                {
                    Label = label?.Trim(),
                    TradePnL = snapshot.Trade.DailyPnL
                }))
            .Where(item => !string.IsNullOrWhiteSpace(item.Label))
            .GroupBy(item => item.Label!, StringComparer.Ordinal)
            .Select(group =>
            {
                var pnlValues = group.Select(item => item.TradePnL).ToList();
                var tradeCount = pnlValues.Count;
                var winCount = pnlValues.Count(value => value > 0);
                var loseCount = pnlValues.Count(value => value < 0);
                var totalPnL = pnlValues.Sum();

                return new TradeBehaviorSummaryItem
                {
                    Label = group.Key,
                    TradeCount = tradeCount,
                    WinCount = winCount,
                    LoseCount = loseCount,
                    WinRate = (winCount + loseCount) > 0 ? (decimal)winCount / (winCount + loseCount) : 0,
                    TotalPnL = decimal.Round(totalPnL, 2, MidpointRounding.AwayFromZero),
                    AveragePnL = tradeCount > 0
                        ? decimal.Round(totalPnL / tradeCount, 2, MidpointRounding.AwayFromZero)
                        : 0
                };
            })
            .OrderByDescending(item => item.TotalPnL)
            .ThenByDescending(item => item.TradeCount)
            .ThenBy(item => item.Label, StringComparer.Ordinal)
            .ToList();
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

    private async Task<List<AccountAnalysisRecord>> BuildAccountAnalysisRecordsAsync(int userId, DateTime? startDate, DateTime? endDate)
    {
        var query = UserAccountsQuery(userId).AsNoTracking();

        if (startDate.HasValue)
        {
            query = query.Where(item => item.Date >= startDate.Value.Date);
        }

        if (endDate.HasValue)
        {
            query = query.Where(item => item.Date <= endDate.Value.Date);
        }

        return await query
            .OrderBy(item => item.Date)
            .Select(item => new AccountAnalysisRecord
            {
                Date = item.Date.Date,
                TotalAssets = item.TotalAssets,
                DailyPnL = item.DailyPnL,
                PositionValue = item.PositionValue
            })
            .ToListAsync();
    }

    private static bool ClosesHoldingCycle(StockTrade trade)
    {
        return TradeMetricsCalculator.IsHoldingClosed(trade);
    }

    private async Task<StockTradeResponse?> BuildCorrectedResponseAsync(int userId, int id)
    {
        var entity = await UserTradesQuery(userId)
            .AsNoTracking()
            .FirstOrDefaultAsync(trade => trade.Id == id);

        if (entity == null)
        {
            return null;
        }

        var correctedSnapshots = await BuildCorrectedSnapshotsAsync(
            UserTradesQuery(userId)
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

    private static bool HasBuyAction(StockTrade trade)
    {
        return trade.BuyPrice > 0 && trade.BuyQuantity > 0;
    }

    private static bool HasSellAction(StockTrade trade)
    {
        return trade.SellPrice > 0 && trade.SellQuantity > 0;
    }

    private static Dictionary<string, DateTime> BuildOpenPositionStartDates(
        IReadOnlyCollection<TradeMetricSnapshot> correctedRecords)
    {
        var openDates = new Dictionary<string, DateTime>(StringComparer.Ordinal);

        foreach (var group in correctedRecords
                     .GroupBy(snapshot => snapshot.Trade.StockCode, StringComparer.Ordinal))
        {
            DateTime? cycleStartDate = null;
            TradeMetricSnapshot? latestSnapshot = null;

            foreach (var snapshot in group
                         .OrderBy(item => item.Trade.TradeDate)
                         .ThenBy(item => item.Trade.Id))
            {
                latestSnapshot = snapshot;
                cycleStartDate ??= snapshot.Trade.TradeDate.Date;

                if (ClosesHoldingCycle(snapshot.Trade))
                {
                    cycleStartDate = null;
                }
            }

            if (latestSnapshot != null
                && !ClosesHoldingCycle(latestSnapshot.Trade)
                && cycleStartDate.HasValue)
            {
                openDates[group.Key] = cycleStartDate.Value;
            }
        }

        return openDates;
    }

    private static List<TradeCycleRecord> BuildTradeCycles(
        IReadOnlyCollection<TradeMetricSnapshot> correctedRecords,
        DateTime? startDate,
        DateTime? endDate)
    {
        var cycles = new List<TradeCycleRecord>();

        foreach (var group in correctedRecords
                     .GroupBy(snapshot => new
                     {
                         snapshot.Trade.StockCode,
                         snapshot.Trade.StockName,
                         snapshot.Trade.Board
                     }))
        {
            TradeCycleBuilder? current = null;

            foreach (var snapshot in group
                         .OrderBy(item => item.Trade.TradeDate)
                         .ThenBy(item => item.Trade.Id))
            {
                current ??= new TradeCycleBuilder(
                    group.Key.StockCode,
                    group.Key.StockName,
                    group.Key.Board.ToString(),
                    snapshot.Trade.TradeDate.Date);

                current.LastRecordDate = snapshot.Trade.TradeDate.Date;
                current.IsClosed = ClosesHoldingCycle(snapshot.Trade);

                if (IsWithinRange(snapshot.Trade.TradeDate, startDate, endDate))
                {
                    current.HasRangeRecord = true;
                    current.RangePnL += snapshot.Trade.DailyPnL;
                }

                if (!current.IsClosed)
                {
                    continue;
                }

                if (current.HasRangeRecord)
                {
                    cycles.Add(current.Build());
                }

                current = null;
            }

            if (current?.HasRangeRecord == true)
            {
                cycles.Add(current.Build());
            }
        }

        return cycles;
    }

    private static CycleAnalysisSummary? BuildCycleAnalysisSummary(
        IReadOnlyCollection<TradeCycleRecord> cycles)
    {
        if (cycles.Count == 0)
        {
            return null;
        }

        var closedCycles = cycles.Where(cycle => cycle.IsClosed).ToList();
        var winningClosedCycles = closedCycles.Where(cycle => cycle.TotalPnL > 0).ToList();
        var losingClosedCycles = closedCycles.Where(cycle => cycle.TotalPnL < 0).ToList();
        var durationSource = closedCycles.Count > 0 ? closedCycles : cycles.ToList();

        return new CycleAnalysisSummary
        {
            TotalCycles = cycles.Count,
            ClosedCycles = closedCycles.Count,
            OpenCycles = cycles.Count - closedCycles.Count,
            ClosedWinRate = closedCycles.Count > 0
                ? decimal.Round((decimal)winningClosedCycles.Count / closedCycles.Count, 4, MidpointRounding.AwayFromZero)
                : 0,
            AverageProfitPerCycle = winningClosedCycles.Count > 0
                ? decimal.Round(winningClosedCycles.Average(cycle => cycle.TotalPnL), 2, MidpointRounding.AwayFromZero)
                : 0,
            AverageLossPerCycle = losingClosedCycles.Count > 0
                ? decimal.Round(losingClosedCycles.Average(cycle => cycle.TotalPnL), 2, MidpointRounding.AwayFromZero)
                : 0,
            AverageHoldingDays = durationSource.Count > 0
                ? decimal.Round((decimal)durationSource.Average(cycle => cycle.HoldingDays), 2, MidpointRounding.AwayFromZero)
                : 0,
            MaxProfitCyclePnL = decimal.Round(cycles.Max(cycle => cycle.TotalPnL), 2, MidpointRounding.AwayFromZero),
            MaxLossCyclePnL = decimal.Round(cycles.Min(cycle => cycle.TotalPnL), 2, MidpointRounding.AwayFromZero)
        };
    }

    private static List<CycleDetailItem> BuildCycleDetails(
        IReadOnlyCollection<TradeCycleRecord> cycles)
    {
        return cycles
            .OrderByDescending(cycle => cycle.StartDate)
            .ThenByDescending(cycle => cycle.TotalPnL)
            .ThenBy(cycle => cycle.StockCode, StringComparer.Ordinal)
            .Select(cycle => new CycleDetailItem
            {
                StockCode = cycle.StockCode,
                StockName = cycle.StockName,
                Board = cycle.Board,
                StartDate = cycle.StartDate,
                EndDate = cycle.EndDate,
                HoldingDays = cycle.HoldingDays,
                TotalPnL = cycle.TotalPnL,
                IsClosed = cycle.IsClosed
            })
            .ToList();
    }

    private static List<DailyPnLHeatmapItem> BuildDailyPnLHeatmap(
        IReadOnlyList<AccountAnalysisRecord> accountRecords,
        IReadOnlyCollection<TradeMetricSnapshot> rangeRecords,
        IReadOnlyDictionary<DateTime, decimal> bankFlowByDate)
    {
        if (accountRecords.Count > 0)
        {
            return accountRecords
                .OrderBy(item => item.Date)
                .Select(item =>
                {
                    bankFlowByDate.TryGetValue(item.Date.Date, out var netFlow);
                    return new DailyPnLHeatmapItem
                    {
                        Date = item.Date.Date,
                        DailyPnL = item.DailyPnL,
                        TotalAssets = item.TotalAssets,
                        NetBankFlow = netFlow,
                        CapitalUtilization = item.TotalAssets > 0
                            ? decimal.Round(item.PositionValue / item.TotalAssets, 4, MidpointRounding.AwayFromZero)
                            : null
                    };
                })
                .ToList();
        }

        return rangeRecords
            .GroupBy(snapshot => snapshot.Trade.TradeDate.Date)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                bankFlowByDate.TryGetValue(group.Key, out var netFlow);
                return new DailyPnLHeatmapItem
                {
                    Date = group.Key,
                    DailyPnL = group.Sum(snapshot => snapshot.Trade.DailyPnL),
                    TotalAssets = null,
                    NetBankFlow = netFlow,
                    CapitalUtilization = null
                };
            })
            .ToList();
    }

    private static DayOutcomeSummary? BuildDayOutcomeSummary(
        IReadOnlyCollection<DailyPnLHeatmapItem> dailySeries)
    {
        if (dailySeries.Count == 0)
        {
            return null;
        }

        var profitDays = dailySeries.Count(item => item.DailyPnL > 0);
        var lossDays = dailySeries.Count(item => item.DailyPnL < 0);
        var flatDays = dailySeries.Count - profitDays - lossDays;
        var totalDays = dailySeries.Count;

        return new DayOutcomeSummary
        {
            ProfitDays = profitDays,
            LossDays = lossDays,
            FlatDays = flatDays,
            ProfitDayRate = decimal.Round((decimal)profitDays / totalDays, 4, MidpointRounding.AwayFromZero),
            LossDayRate = decimal.Round((decimal)lossDays / totalDays, 4, MidpointRounding.AwayFromZero),
            FlatDayRate = decimal.Round((decimal)flatDays / totalDays, 4, MidpointRounding.AwayFromZero)
        };
    }

    private static StreakAnalysisSummary? BuildStreakAnalysis(
        IReadOnlyList<DailyPnLHeatmapItem> dailySeries)
    {
        if (dailySeries.Count == 0)
        {
            return null;
        }

        var summary = new StreakAnalysisSummary();
        var currentWinLength = 0;
        var currentLossLength = 0;
        DateTime? currentWinStart = null;
        DateTime? currentLossStart = null;

        foreach (var item in dailySeries.OrderBy(point => point.Date))
        {
            if (item.DailyPnL > 0)
            {
                currentLossLength = 0;
                currentLossStart = null;
                currentWinStart ??= item.Date;
                currentWinLength += 1;

                if (currentWinLength > summary.MaxWinDays)
                {
                    summary.MaxWinDays = currentWinLength;
                    summary.MaxWinStartDate = currentWinStart;
                    summary.MaxWinEndDate = item.Date;
                }

                continue;
            }

            if (item.DailyPnL < 0)
            {
                currentWinLength = 0;
                currentWinStart = null;
                currentLossStart ??= item.Date;
                currentLossLength += 1;

                if (currentLossLength > summary.MaxLossDays)
                {
                    summary.MaxLossDays = currentLossLength;
                    summary.MaxLossStartDate = currentLossStart;
                    summary.MaxLossEndDate = item.Date;
                }

                continue;
            }

            currentWinLength = 0;
            currentLossLength = 0;
            currentWinStart = null;
            currentLossStart = null;
        }

        return summary;
    }

    private static AdjustedReturnSummary? BuildAdjustedReturnSummary(
        IReadOnlyList<AccountAnalysisRecord> accountRecords,
        IReadOnlyCollection<BankFlow> bankFlows)
    {
        if (accountRecords.Count == 0)
        {
            return null;
        }

        var startRecord = accountRecords.First();
        var endRecord = accountRecords.Last();
        var flowsInRange = bankFlows
            .Where(flow => flow.Date.Date >= startRecord.Date.Date && flow.Date.Date <= endRecord.Date.Date)
            .ToList();
        var totalDays = Math.Max(1, (endRecord.Date.Date - startRecord.Date.Date).Days);
        var netBankFlow = flowsInRange.Sum(flow => string.Equals(flow.FlowType, "转入", StringComparison.Ordinal)
            ? flow.Amount
            : -flow.Amount);
        var weightedCapitalBase = startRecord.TotalAssets;

        foreach (var flow in flowsInRange)
        {
            var weight = totalDays == 0
                ? 0m
                : decimal.Round((decimal)(endRecord.Date.Date - flow.Date.Date).Days / totalDays, 6, MidpointRounding.AwayFromZero);
            var signedAmount = string.Equals(flow.FlowType, "转入", StringComparison.Ordinal)
                ? flow.Amount
                : -flow.Amount;
            weightedCapitalBase += signedAmount * weight;
        }

        decimal? returnRate = null;
        if (weightedCapitalBase != 0)
        {
            returnRate = decimal.Round(
                (endRecord.TotalAssets - startRecord.TotalAssets - netBankFlow) / weightedCapitalBase,
                4,
                MidpointRounding.AwayFromZero);
        }

        return new AdjustedReturnSummary
        {
            ReturnRate = returnRate,
            StartAssets = startRecord.TotalAssets,
            EndAssets = endRecord.TotalAssets,
            NetBankFlow = netBankFlow,
            WeightedCapitalBase = decimal.Round(weightedCapitalBase, 2, MidpointRounding.AwayFromZero)
        };
    }

    private static TTradeAnalysisSummary? BuildTTradeAnalysis(
        IReadOnlyCollection<TradeMetricSnapshot> rangeRecords)
    {
        var tTrades = rangeRecords
            .Where(snapshot => HasBuyAction(snapshot.Trade) && HasSellAction(snapshot.Trade))
            .ToList();

        if (tTrades.Count == 0)
        {
            return null;
        }

        var winCount = tTrades.Count(snapshot => snapshot.Trade.DailyPnL > 0);
        var loseCount = tTrades.Count(snapshot => snapshot.Trade.DailyPnL < 0);
        var totalPnL = tTrades.Sum(snapshot => snapshot.Trade.DailyPnL);

        return new TTradeAnalysisSummary
        {
            TradeCount = tTrades.Count,
            WinCount = winCount,
            LoseCount = loseCount,
            WinRate = (winCount + loseCount) > 0
                ? decimal.Round((decimal)winCount / (winCount + loseCount), 4, MidpointRounding.AwayFromZero)
                : 0,
            TotalPnL = decimal.Round(totalPnL, 2, MidpointRounding.AwayFromZero),
            AveragePnL = decimal.Round(totalPnL / tTrades.Count, 2, MidpointRounding.AwayFromZero)
        };
    }

    private static List<TTradeDetailItem> BuildTTradeDetails(
        IReadOnlyCollection<TradeMetricSnapshot> rangeRecords)
    {
        return rangeRecords
            .Where(snapshot => HasBuyAction(snapshot.Trade) && HasSellAction(snapshot.Trade))
            .OrderByDescending(snapshot => snapshot.Trade.TradeDate)
            .ThenByDescending(snapshot => snapshot.Trade.DailyPnL)
            .ThenBy(snapshot => snapshot.Trade.StockCode, StringComparer.Ordinal)
            .Select(snapshot => new TTradeDetailItem
            {
                TradeDate = snapshot.Trade.TradeDate,
                StockCode = snapshot.Trade.StockCode,
                StockName = snapshot.Trade.StockName,
                Board = snapshot.Trade.Board.ToString(),
                BuyPrice = snapshot.Trade.BuyPrice,
                BuyQuantity = snapshot.Trade.BuyQuantity,
                SellPrice = snapshot.Trade.SellPrice,
                SellQuantity = snapshot.Trade.SellQuantity,
                PositionQuantity = snapshot.Trade.PositionQuantity,
                DailyPnL = snapshot.Trade.DailyPnL,
                IsLiquidated = snapshot.Trade.IsLiquidated
            })
            .ToList();
    }

    private static CapitalAnalysisSummary? BuildCapitalAnalysis(
        IReadOnlyList<AccountAnalysisRecord> accountRecords)
    {
        if (accountRecords.Count == 0)
        {
            return null;
        }

        var utilizationSeries = accountRecords
            .Where(item => item.TotalAssets > 0)
            .Select(item => item.PositionValue / item.TotalAssets)
            .ToList();

        decimal? dailyVolatility = null;
        var dailyReturns = new List<double>();
        for (var index = 1; index < accountRecords.Count; index++)
        {
            var previousAssets = accountRecords[index - 1].TotalAssets;
            if (previousAssets == 0)
            {
                continue;
            }

            dailyReturns.Add((double)(accountRecords[index].DailyPnL / previousAssets));
        }

        if (dailyReturns.Count > 1)
        {
            var mean = dailyReturns.Average();
            var variance = dailyReturns.Average(value => Math.Pow(value - mean, 2));
            dailyVolatility = decimal.Round((decimal)Math.Sqrt(variance), 4, MidpointRounding.AwayFromZero);
        }

        return new CapitalAnalysisSummary
        {
            LatestUtilization = utilizationSeries.Count > 0
                ? decimal.Round(utilizationSeries[^1], 4, MidpointRounding.AwayFromZero)
                : null,
            AverageUtilization = utilizationSeries.Count > 0
                ? decimal.Round(utilizationSeries.Average(), 4, MidpointRounding.AwayFromZero)
                : null,
            MaxUtilization = utilizationSeries.Count > 0
                ? decimal.Round(utilizationSeries.Max(), 4, MidpointRounding.AwayFromZero)
                : null,
            DailyVolatility = dailyVolatility
        };
    }

    private static List<PeriodPnLDistributionItem> BuildPeriodPnLDistribution(
        IReadOnlyCollection<DailyPnLHeatmapItem> dailySeries,
        PeriodBucketType bucketType)
    {
        return dailySeries
            .GroupBy(item => GetPeriodRange(item.Date, bucketType))
            .Select(group =>
            {
                var range = group.Key;
                return new PeriodPnLDistributionItem
                {
                    Label = BuildPeriodLabel(range.StartDate, bucketType),
                    StartDate = range.StartDate,
                    EndDate = range.EndDate,
                    TotalPnL = decimal.Round(group.Sum(item => item.DailyPnL), 2, MidpointRounding.AwayFromZero)
                };
            })
            .OrderByDescending(item => item.StartDate)
            .ToList();
    }

    private static List<BoardRotationItem> BuildBoardRotations(
        IReadOnlyCollection<TradeMetricSnapshot> rangeRecords,
        decimal totalPnL)
    {
        return rangeRecords
            .GroupBy(snapshot => snapshot.Trade.Board.ToString())
            .Select(group =>
            {
                var dailySeries = group
                    .GroupBy(snapshot => snapshot.Trade.TradeDate.Date)
                    .Select(dayGroup => dayGroup.Sum(snapshot => snapshot.Trade.DailyPnL))
                    .ToList();
                var groupTotalPnL = dailySeries.Sum();
                var profitDays = dailySeries.Count(value => value > 0);
                var lossDays = dailySeries.Count(value => value < 0);

                return new BoardRotationItem
                {
                    Board = group.Key,
                    TotalPnL = decimal.Round(groupTotalPnL, 2, MidpointRounding.AwayFromZero),
                    ContributionRate = totalPnL != 0
                        ? decimal.Round(groupTotalPnL / totalPnL, 4, MidpointRounding.AwayFromZero)
                        : 0,
                    ActiveDays = dailySeries.Count,
                    ProfitDays = profitDays,
                    LossDays = lossDays,
                    WinDayRate = dailySeries.Count > 0
                        ? decimal.Round((decimal)profitDays / dailySeries.Count, 4, MidpointRounding.AwayFromZero)
                        : 0
                };
            })
            .OrderByDescending(item => item.TotalPnL)
            .ToList();
    }

    private static PeriodDateRange GetPeriodRange(DateTime date, PeriodBucketType bucketType)
    {
        var day = date.Date;

        return bucketType switch
        {
            PeriodBucketType.Week => BuildWeekRange(day),
            PeriodBucketType.Month => new PeriodDateRange(
                new DateTime(day.Year, day.Month, 1),
                new DateTime(day.Year, day.Month, DateTime.DaysInMonth(day.Year, day.Month))),
            PeriodBucketType.Quarter => BuildQuarterRange(day),
            _ => new PeriodDateRange(day, day)
        };
    }

    private static PeriodDateRange BuildWeekRange(DateTime date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7;
        var start = date.AddDays(-offset).Date;
        var end = start.AddDays(6);
        return new PeriodDateRange(start, end);
    }

    private static PeriodDateRange BuildQuarterRange(DateTime date)
    {
        var quarterStartMonth = ((date.Month - 1) / 3) * 3 + 1;
        var start = new DateTime(date.Year, quarterStartMonth, 1);
        var end = start.AddMonths(3).AddDays(-1);
        return new PeriodDateRange(start, end);
    }

    private static string BuildPeriodLabel(DateTime startDate, PeriodBucketType bucketType)
    {
        return bucketType switch
        {
            PeriodBucketType.Week => $"{startDate:yyyy-MM-dd} 当周",
            PeriodBucketType.Month => $"{startDate:yyyy-MM}",
            PeriodBucketType.Quarter => $"{startDate.Year} Q{((startDate.Month - 1) / 3) + 1}",
            _ => $"{startDate:yyyy-MM-dd}"
        };
    }

    private static List<DailyWinRateItem> BuildDailyWinRates(IReadOnlyCollection<TradeMetricSnapshot> rangeRecords)
    {
        return rangeRecords
            .GroupBy(snapshot => snapshot.Trade.TradeDate.Date)
            .Select(group =>
            {
                var winCount = group.Count(snapshot => snapshot.Trade.DailyPnL > 0);
                var loseCount = group.Count(snapshot => snapshot.Trade.DailyPnL < 0);
                return new DailyWinRateItem
                {
                    Date = group.Key,
                    WinCount = winCount,
                    LoseCount = loseCount,
                    WinRate = (winCount + loseCount) > 0
                        ? decimal.Round((decimal)winCount / (winCount + loseCount), 4, MidpointRounding.AwayFromZero)
                        : 0,
                    TotalPnL = group.Sum(snapshot => snapshot.Trade.DailyPnL)
                };
            })
            .Where(item => item.WinCount + item.LoseCount > 0)
            .OrderBy(item => item.Date)
            .ToList();
    }

    private static DailyWinRateItem? SelectBestWinRateDay(IReadOnlyCollection<DailyWinRateItem> dailyWinRates)
    {
        return dailyWinRates
            .OrderByDescending(item => item.WinRate)
            .ThenByDescending(item => item.WinCount + item.LoseCount)
            .ThenByDescending(item => item.TotalPnL)
            .ThenBy(item => item.Date)
            .FirstOrDefault();
    }

    private static DailyWinRateItem? SelectWorstWinRateDay(IReadOnlyCollection<DailyWinRateItem> dailyWinRates)
    {
        return dailyWinRates
            .OrderBy(item => item.WinRate)
            .ThenByDescending(item => item.WinCount + item.LoseCount)
            .ThenBy(item => item.TotalPnL)
            .ThenBy(item => item.Date)
            .FirstOrDefault();
    }

    private static PnLIntervalAnalysisItem? BuildBestProfitInterval(
        IReadOnlyList<AccountAnalysisRecord> accountRecords,
        IReadOnlyCollection<TradeMetricSnapshot> rangeRecords)
    {
        var series = accountRecords.Count > 0
            ? accountRecords.Select(item => new PnLSeriesPoint(item.Date, item.DailyPnL)).ToList()
            : rangeRecords
                .GroupBy(snapshot => snapshot.Trade.TradeDate.Date)
                .Select(group => new PnLSeriesPoint(group.Key, group.Sum(snapshot => snapshot.Trade.DailyPnL)))
                .OrderBy(item => item.Date)
                .ToList();

        if (series.Count == 0)
        {
            return null;
        }

        var bestSum = decimal.MinValue;
        var currentSum = 0m;
        var bestStartIndex = 0;
        var bestEndIndex = 0;
        var currentStartIndex = 0;

        for (var index = 0; index < series.Count; index++)
        {
            if (currentSum <= 0)
            {
                currentSum = series[index].PnL;
                currentStartIndex = index;
            }
            else
            {
                currentSum += series[index].PnL;
            }

            if (currentSum > bestSum)
            {
                bestSum = currentSum;
                bestStartIndex = currentStartIndex;
                bestEndIndex = index;
            }
        }

        return new PnLIntervalAnalysisItem
        {
            StartDate = series[bestStartIndex].Date,
            EndDate = series[bestEndIndex].Date,
            TradingDays = bestEndIndex - bestStartIndex + 1,
            TotalPnL = decimal.Round(bestSum, 2, MidpointRounding.AwayFromZero)
        };
    }

    private static DrawdownAnalysisItem? BuildMaxDrawdownInterval(
        IReadOnlyList<AccountAnalysisRecord> accountRecords,
        IReadOnlyCollection<TradeMetricSnapshot> rangeRecords)
    {
        if (accountRecords.Count > 0)
        {
            var peakRecord = accountRecords[0];
            var selectedPeak = peakRecord;
            var selectedTrough = peakRecord;
            var maxDrawdownAmount = 0m;
            var maxDrawdownRate = 0m;

            foreach (var record in accountRecords)
            {
                if (record.TotalAssets > peakRecord.TotalAssets)
                {
                    peakRecord = record;
                }

                var drawdownAmount = peakRecord.TotalAssets - record.TotalAssets;
                var drawdownRate = peakRecord.TotalAssets > 0
                    ? decimal.Round(drawdownAmount / peakRecord.TotalAssets, 4, MidpointRounding.AwayFromZero)
                    : 0;

                if (drawdownAmount > maxDrawdownAmount
                    || (drawdownAmount == maxDrawdownAmount && drawdownRate > maxDrawdownRate))
                {
                    selectedPeak = peakRecord;
                    selectedTrough = record;
                    maxDrawdownAmount = drawdownAmount;
                    maxDrawdownRate = drawdownRate;
                }
            }

            if (maxDrawdownAmount <= 0)
            {
                return null;
            }

            DateTime? recoveryDate = null;
            int? recoveryDays = null;
            var selectedPeakIndex = -1;
            var selectedTroughIndex = -1;
            for (var index = 0; index < accountRecords.Count; index++)
            {
                if (selectedPeakIndex < 0 && accountRecords[index].Date == selectedPeak.Date)
                {
                    selectedPeakIndex = index;
                }

                if (selectedTroughIndex < 0 && accountRecords[index].Date == selectedTrough.Date)
                {
                    selectedTroughIndex = index;
                }
            }
            if (selectedPeakIndex >= 0 && selectedTroughIndex >= selectedPeakIndex)
            {
                for (var index = selectedTroughIndex + 1; index < accountRecords.Count; index++)
                {
                    if (accountRecords[index].TotalAssets > selectedPeak.TotalAssets)
                    {
                        recoveryDate = accountRecords[index].Date;
                        recoveryDays = Math.Max(1, (accountRecords[index].Date.Date - selectedTrough.Date.Date).Days);
                        break;
                    }
                }
            }

            return new DrawdownAnalysisItem
            {
                PeakDate = selectedPeak.Date,
                TroughDate = selectedTrough.Date,
                PeakValue = selectedPeak.TotalAssets,
                TroughValue = selectedTrough.TotalAssets,
                DrawdownAmount = decimal.Round(maxDrawdownAmount, 2, MidpointRounding.AwayFromZero),
                DrawdownRate = maxDrawdownRate,
                RecoveryDate = recoveryDate,
                RecoveryDays = recoveryDays
            };
        }

        var fallbackSeries = rangeRecords
            .GroupBy(snapshot => snapshot.Trade.TradeDate.Date)
            .Select(group => new PnLSeriesPoint(group.Key, group.Sum(snapshot => snapshot.Trade.DailyPnL)))
            .OrderBy(item => item.Date)
            .ToList();

        if (fallbackSeries.Count == 0)
        {
            return null;
        }

        var cumulativeValue = 0m;
        var peakValue = 0m;
        var peakDate = fallbackSeries[0].Date;
        var selectedPeakDate = peakDate;
        var selectedTroughDate = peakDate;
        var maxDrawdown = 0m;

        foreach (var point in fallbackSeries)
        {
            cumulativeValue += point.PnL;
            if (cumulativeValue > peakValue)
            {
                peakValue = cumulativeValue;
                peakDate = point.Date;
            }

            var drawdown = peakValue - cumulativeValue;
            if (drawdown > maxDrawdown)
            {
                maxDrawdown = drawdown;
                selectedPeakDate = peakDate;
                selectedTroughDate = point.Date;
            }
        }

        if (maxDrawdown <= 0)
        {
            return null;
        }

        return new DrawdownAnalysisItem
        {
            PeakDate = selectedPeakDate,
            TroughDate = selectedTroughDate,
            PeakValue = peakValue,
            TroughValue = peakValue - maxDrawdown,
            DrawdownAmount = decimal.Round(maxDrawdown, 2, MidpointRounding.AwayFromZero),
            DrawdownRate = 0,
            RecoveryDate = null,
            RecoveryDays = null
        };
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

    private sealed class AccountAnalysisRecord
    {
        public DateTime Date { get; init; }
        public decimal TotalAssets { get; init; }
        public decimal DailyPnL { get; init; }
        public decimal PositionValue { get; init; }
    }

    private sealed class TradeCycleBuilder
    {
        public TradeCycleBuilder(string stockCode, string stockName, string board, DateTime startDate)
        {
            StockCode = stockCode;
            StockName = stockName;
            Board = board;
            StartDate = startDate.Date;
            LastRecordDate = startDate.Date;
        }

        public string StockCode { get; }
        public string StockName { get; }
        public string Board { get; }
        public DateTime StartDate { get; }
        public DateTime LastRecordDate { get; set; }
        public decimal RangePnL { get; set; }
        public bool HasRangeRecord { get; set; }
        public bool IsClosed { get; set; }

        public TradeCycleRecord Build()
        {
            return new TradeCycleRecord
            {
                StockCode = StockCode,
                StockName = StockName,
                Board = Board,
                StartDate = StartDate,
                EndDate = IsClosed ? LastRecordDate : null,
                HoldingDays = Math.Max(1, (LastRecordDate.Date - StartDate.Date).Days + 1),
                TotalPnL = decimal.Round(RangePnL, 2, MidpointRounding.AwayFromZero),
                IsClosed = IsClosed
            };
        }
    }

    private sealed class TradeCycleRecord
    {
        public string StockCode { get; init; } = string.Empty;
        public string StockName { get; init; } = string.Empty;
        public string Board { get; init; } = string.Empty;
        public DateTime StartDate { get; init; }
        public DateTime? EndDate { get; init; }
        public int HoldingDays { get; init; }
        public decimal TotalPnL { get; init; }
        public bool IsClosed { get; init; }
    }

    private enum PeriodBucketType
    {
        Week,
        Month,
        Quarter
    }

    private sealed record PeriodDateRange(DateTime StartDate, DateTime EndDate);

    private sealed record PnLSeriesPoint(DateTime Date, decimal PnL);

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
            SellReason = entity.SellReason,
            EmotionTags = ParseEmotionTags(entity.EmotionTags),
            TradeTags = ParseTradeTags(entity.TradeTags),
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
            SellReason = entity.SellReason,
            EmotionTags = ParseEmotionTags(entity.EmotionTags),
            TradeTags = ParseTradeTags(entity.TradeTags),
            TradeNote = entity.TradeNote,
            TonghuashunLink = entity.TonghuashunLink
        };
    }
}
