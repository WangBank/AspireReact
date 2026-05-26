using AspireReact.Server.Data;
using AspireReact.Server.DTOs;
using AspireReact.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace AspireReact.Server.Services;

public class TradeNoteService : ITradeNoteService
{
    private readonly AppDbContext _db;

    public TradeNoteService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// 新增笔记
    /// </summary>
    public async Task<NoteResult> CreateAsync(NoteRequest request)
    {
        var entity = new TradeNote
        {
            Date = request.Date.Date,
            StockCode = string.IsNullOrWhiteSpace(request.StockCode) ? null : request.StockCode.Trim(),
            Content = request.Content,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.TradeNotes.Add(entity);
        await _db.SaveChangesAsync();

        return new NoteResult
        {
            Success = true,
            Message = "笔记添加成功",
            Data = ToResponse(entity)
        };
    }

    /// <summary>
    /// 修改笔记
    /// </summary>
    public async Task<NoteResult> UpdateAsync(int id, NoteRequest request)
    {
        var entity = await _db.TradeNotes.FindAsync(id);
        if (entity == null)
        {
            return new NoteResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的笔记"
            };
        }

        entity.Date = request.Date.Date;
        entity.StockCode = string.IsNullOrWhiteSpace(request.StockCode) ? null : request.StockCode.Trim();
        entity.Content = request.Content;
        entity.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();

        return new NoteResult
        {
            Success = true,
            Message = "笔记修改成功",
            Data = ToResponse(entity)
        };
    }

    /// <summary>
    /// 删除笔记
    /// </summary>
    public async Task<NoteResult> DeleteAsync(int id)
    {
        var entity = await _db.TradeNotes.FindAsync(id);
        if (entity == null)
        {
            return new NoteResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的笔记"
            };
        }

        _db.TradeNotes.Remove(entity);
        await _db.SaveChangesAsync();

        return new NoteResult
        {
            Success = true,
            Message = "笔记删除成功"
        };
    }

    /// <summary>
    /// 按条件搜索笔记（支持日期、股票代码、关键词）
    /// </summary>
    public async Task<List<NoteResponse>> SearchAsync(DateTime? date = null, string? stockCode = null, string? keyword = null)
    {
        var query = _db.TradeNotes.AsNoTracking();

        if (date.HasValue)
        {
            var d = date.Value.Date;
            query = query.Where(n => n.Date == d);
        }

        if (!string.IsNullOrWhiteSpace(stockCode))
        {
            var code = stockCode.Trim();
            query = query.Where(n => n.StockCode == code);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var kw = keyword.Trim();
            query = query.Where(n => n.Content.Contains(kw));
        }

        var list = await query
            .OrderByDescending(n => n.Date)
            .ThenByDescending(n => n.UpdatedAt)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    /// <summary>
    /// 获取全局笔记（StockCode 为空）
    /// </summary>
    public async Task<List<NoteResponse>> GetGlobalNotesAsync()
    {
        var list = await _db.TradeNotes
            .AsNoTracking()
            .Where(n => n.StockCode == null)
            .OrderByDescending(n => n.Date)
            .ThenByDescending(n => n.UpdatedAt)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    /// <summary>
    /// 获取指定股票的笔记
    /// </summary>
    public async Task<List<NoteResponse>> GetByStockCodeAsync(string stockCode)
    {
        var list = await _db.TradeNotes
            .AsNoTracking()
            .Where(n => n.StockCode == stockCode)
            .OrderByDescending(n => n.Date)
            .ThenByDescending(n => n.UpdatedAt)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    /// <summary>
    /// 将实体映射为响应 DTO
    /// </summary>
    private static NoteResponse ToResponse(TradeNote entity)
    {
        return new NoteResponse
        {
            Id = entity.Id,
            Date = entity.Date,
            StockCode = entity.StockCode,
            Content = entity.Content,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }
}