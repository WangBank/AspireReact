using Lies.Server.DTOs;

namespace Lies.Server.Services;

/// <summary>
/// 笔记服务接口
/// </summary>
public interface ITradeNoteService
{
    /// <summary>
    /// 新增笔记
    /// </summary>
    Task<NoteResult> CreateAsync(int userId, NoteRequest request);

    /// <summary>
    /// 修改笔记
    /// </summary>
    Task<NoteResult> UpdateAsync(int userId, int id, NoteRequest request);

    /// <summary>
    /// 删除笔记
    /// </summary>
    Task<NoteResult> DeleteAsync(int userId, int id);

    /// <summary>
    /// 按条件搜索笔记（支持日期、心魔代码、关键词）
    /// </summary>
    Task<List<NoteResponse>> SearchAsync(int userId, DateTime? date = null, string? stockCode = null, string? keyword = null);

    /// <summary>
    /// 获取全局笔记（StockCode 为空）
    /// </summary>
    Task<List<NoteResponse>> GetGlobalNotesAsync(int userId);

    /// <summary>
    /// 获取指定心魔的笔记
    /// </summary>
    Task<List<NoteResponse>> GetByStockCodeAsync(int userId, string stockCode);
}
