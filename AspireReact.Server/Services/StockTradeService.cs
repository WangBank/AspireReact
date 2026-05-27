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
            TradeNote = request.TradeNote,
            TonghuashunLink = request.TonghuashunLink
        };

        _db.StockTrades.Add(entity);
        await _db.SaveChangesAsync();

        return new StockTradeResult
        {
            Success = true,
            Message = "交易记录添加成功",
            Data = ToResponse(entity)
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
        entity.TradeNote = request.TradeNote;
        entity.TonghuashunLink = request.TonghuashunLink;

        await _db.SaveChangesAsync();

        return new StockTradeResult
        {
            Success = true,
            Message = "交易记录修改成功",
            Data = ToResponse(entity)
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
        var entity = await _db.StockTrades
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (entity == null)
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
            Data = ToResponse(entity)
        };
    }

    /// <summary>
    /// 多条件筛选查询（分页）
    /// </summary>
    public async Task<PagedResult<StockTradeResponse>> QueryAsync(TradeQueryRequest request)
    {
        var query = _db.StockTrades.AsNoTracking();

        // 按心魔代码筛选
        if (!string.IsNullOrWhiteSpace(request.StockCode))
        {
            var code = request.StockCode.Trim();
            query = query.Where(t => t.StockCode.Contains(code));
        }

        // 按交易日期范围筛选
        if (request.TradeDateStart.HasValue)
        {
            var start = request.TradeDateStart.Value.Date;
            query = query.Where(t => t.TradeDate >= start);
        }

        if (request.TradeDateEnd.HasValue)
        {
            var end = request.TradeDateEnd.Value.Date;
            query = query.Where(t => t.TradeDate <= end);
        }

        // 按板块筛选
        if (!string.IsNullOrWhiteSpace(request.Board))
        {
            var board = ParseBoard(request.Board);
            query = query.Where(t => t.Board == board);
        }

        // 总数
        var total = await query.CountAsync();

        // 分页
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var items = await query
            .OrderByDescending(t => t.TradeDate)
            .ThenBy(t => t.StockCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => ToResponse(t))
            .ToListAsync();

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
        var query = _db.StockTrades.AsNoTracking();

        // 按日期范围过滤
        if (request.StartDate.HasValue)
        {
            var start = request.StartDate.Value.Date;
            query = query.Where(t => t.TradeDate >= start);
        }

        if (request.EndDate.HasValue)
        {
            var end = request.EndDate.Value.Date;
            query = query.Where(t => t.TradeDate <= end);
        }

        // 按心魔过滤
        if (!string.IsNullOrWhiteSpace(request.StockCode))
        {
            var code = request.StockCode.Trim();
            query = query.Where(t => t.StockCode == code);
        }

        // 按板块过滤
        if (!string.IsNullOrWhiteSpace(request.Board))
        {
            var board = ParseBoard(request.Board);
            query = query.Where(t => t.Board == board);
        }

        var trades = await query.ToListAsync();

        // 按心魔汇总
        var byStock = trades
            .GroupBy(t => new { t.StockCode, t.StockName, t.Board })
            .Select(g => new TradeSummaryItem
            {
                StockCode = g.Key.StockCode,
                StockName = g.Key.StockName,
                Board = g.Key.Board.ToString(),
                TradeCount = g.Count(),
                TotalPositionPnL = g.Sum(t => t.PositionPnL),
                TotalCumulativePnL = g.Sum(t => t.CumulativePnL),
                WinRate = g.Count() > 0
                    ? (decimal)g.Count(t => t.PositionPnL > 0) / g.Count() * 100
                    : 0
            })
            .OrderByDescending(x => x.TotalPositionPnL)
            .ToList();

        // 按板块汇总
        var byBoard = trades
            .GroupBy(t => t.Board)
            .Select(g => new TradeSummaryItem
            {
                StockCode = "—",
                StockName = g.Key.ToString(),
                Board = g.Key.ToString(),
                TradeCount = g.Count(),
                TotalPositionPnL = g.Sum(t => t.PositionPnL),
                TotalCumulativePnL = g.Sum(t => t.CumulativePnL),
                WinRate = g.Count() > 0
                    ? (decimal)g.Count(t => t.PositionPnL > 0) / g.Count() * 100
                    : 0
            })
            .OrderByDescending(x => x.TotalPositionPnL)
            .ToList();

        var totalPnL = trades.Sum(t => t.PositionPnL);
        var winTrades = trades.Count(t => t.PositionPnL > 0);
        var loseTrades = trades.Count(t => t.PositionPnL < 0);

        return new TradeSummaryResponse
        {
            TotalTrades = trades.Count,
            TotalPnL = totalPnL,
            WinTrades = winTrades,
            LoseTrades = loseTrades,
            OverallWinRate = trades.Count > 0 ? (decimal)winTrades / trades.Count * 100 : 0,
            ByStock = byStock,
            ByBoard = byBoard
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
            TradeNote = entity.TradeNote,
            TonghuashunLink = entity.TonghuashunLink
        };
    }
}