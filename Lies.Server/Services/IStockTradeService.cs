using Lies.Server.DTOs;

namespace Lies.Server.Services;

/// <summary>
/// 心魔交易服务接口
/// </summary>
public interface IStockTradeService
{
    /// <summary>
    /// 新增交易记录（带验证）
    /// </summary>
    Task<StockTradeResult> CreateAsync(int userId, StockTradeRequest request);

    /// <summary>
    /// 修改交易记录
    /// </summary>
    Task<StockTradeResult> UpdateAsync(int userId, int id, StockTradeRequest request);

    /// <summary>
    /// 删除交易记录
    /// </summary>
    Task<StockTradeResult> DeleteAsync(int userId, int id);

    /// <summary>
    /// 单条详情
    /// </summary>
    Task<StockTradeResult> GetByIdAsync(int userId, int id);

    /// <summary>
    /// 多条件筛选查询（分页）
    /// </summary>
    Task<PagedResult<StockTradeResponse>> QueryAsync(int userId, TradeQueryRequest request);

    /// <summary>
    /// 统计汇总（按日期范围、心魔、板块统计盈亏）
    /// </summary>
    Task<TradeSummaryResponse> GetSummaryAsync(int userId, TradeSummaryRequest request);

    /// <summary>
    /// 批量新增交易记录
    /// </summary>
    Task<BatchStockTradeResult> BatchCreateAsync(int userId, BatchStockTradeRequest request);

    /// <summary>
    /// 批量修改交易记录
    /// </summary>
    Task<BatchStockTradeResult> BatchUpdateAsync(int userId, BatchTradeUpdateRequest request);
}
