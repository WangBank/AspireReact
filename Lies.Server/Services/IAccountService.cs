using Lies.Server.DTOs;
using Lies.Server.Entities;

namespace Lies.Server.Services;

/// <summary>
/// 账户资金服务接口
/// </summary>
public interface IAccountService
{
    /// <summary>
    /// 新增当日账户资金
    /// </summary>
    Task<AccountResult> CreateAsync(AccountDailyRequest request);

    /// <summary>
    /// 修改账户资金记录
    /// </summary>
    Task<AccountResult> UpdateAsync(int id, AccountDailyRequest request);

    /// <summary>
    /// 删除账户资金记录
    /// </summary>
    Task<AccountResult> DeleteAsync(int id);

    /// <summary>
    /// 按日期范围查询账户资金
    /// </summary>
    Task<List<AccountDailyResponse>> GetByDateRangeAsync(DateTime? startDate, DateTime? endDate);

    /// <summary>
    /// 获取最新一条账户资金记录
    /// </summary>
    Task<AccountDailyResponse?> GetLatestAsync();

    /// <summary>
    /// 根据 ID 获取账户资金记录
    /// </summary>
    Task<AccountDailyResponse?> GetByIdAsync(int id);
}

/// <summary>
/// 账户操作结果
/// </summary>
public class AccountResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public AccountDailyResponse? Data { get; set; }
}
