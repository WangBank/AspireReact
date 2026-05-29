using AspireReact.Server.DTOs;

namespace AspireReact.Server.Services;

/// <summary>
/// 银证流水服务接口
/// </summary>
public interface IBankFlowService
{
    /// <summary>
    /// 新增流水记录
    /// </summary>
    Task<BankFlowResult> CreateAsync(BankFlowRequest request);

    /// <summary>
    /// 修改流水记录
    /// </summary>
    Task<BankFlowResult> UpdateAsync(int id, BankFlowRequest request);

    /// <summary>
    /// 删除流水记录
    /// </summary>
    Task<BankFlowResult> DeleteAsync(int id);

    /// <summary>
    /// 按日期范围查询流水
    /// </summary>
    Task<List<BankFlowResponse>> GetByDateRangeAsync(DateTime? startDate, DateTime? endDate);

    /// <summary>
    /// 获取最近10条流水
    /// </summary>
    Task<List<BankFlowResponse>> GetRecentAsync();

    /// <summary>
    /// 根据 ID 获取银证流水记录
    /// </summary>
    Task<BankFlowResponse?> GetByIdAsync(int id);
}
