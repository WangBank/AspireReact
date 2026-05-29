using AspireReact.Server.Data;
using AspireReact.Server.DTOs;
using AspireReact.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace AspireReact.Server.Services;

public class AccountService : IAccountService
{
    private readonly AppDbContext _db;

    public AccountService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// 新增当日账户资金
    /// </summary>
    public async Task<AccountResult> CreateAsync(AccountDailyRequest request)
    {
        // 检查日期是否已存在
        var exists = await _db.AccountDailies.AnyAsync(a => a.Date == request.Date.Date);
        if (exists)
        {
            return new AccountResult
            {
                Success = false,
                Message = $"日期 {request.Date:yyyy-MM-dd} 的账户资金记录已存在，请勿重复添加"
            };
        }

        var entity = new AccountDaily
        {
            Date = request.Date.Date,
            TotalAssets = request.TotalAssets,
            PositionValue = request.PositionValue,
            AvailableFunds = request.AvailableFunds,
            DailyPnL = request.DailyPnL,
            Remark = request.Remark
        };

        _db.AccountDailies.Add(entity);
        await _db.SaveChangesAsync();

        return new AccountResult
        {
            Success = true,
            Message = "账户资金记录添加成功",
            Data = ToResponse(entity)
        };
    }

    /// <summary>
    /// 修改账户资金记录
    /// </summary>
    public async Task<AccountResult> UpdateAsync(int id, AccountDailyRequest request)
    {
        var entity = await _db.AccountDailies.FindAsync(id);
        if (entity == null)
        {
            return new AccountResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的账户资金记录"
            };
        }

        // 如果修改了日期，检查新日期是否与其他记录冲突
        if (entity.Date != request.Date.Date)
        {
            var dateExists = await _db.AccountDailies.AnyAsync(a => a.Date == request.Date.Date && a.Id != id);
            if (dateExists)
            {
                return new AccountResult
                {
                    Success = false,
                    Message = $"日期 {request.Date:yyyy-MM-dd} 的账户资金记录已存在，无法修改为该日期"
                };
            }
        }

        entity.Date = request.Date.Date;
        entity.TotalAssets = request.TotalAssets;
        entity.PositionValue = request.PositionValue;
        entity.AvailableFunds = request.AvailableFunds;
        entity.DailyPnL = request.DailyPnL;
        entity.Remark = request.Remark;

        await _db.SaveChangesAsync();

        return new AccountResult
        {
            Success = true,
            Message = "账户资金记录修改成功",
            Data = ToResponse(entity)
        };
    }

    /// <summary>
    /// 删除账户资金记录
    /// </summary>
    public async Task<AccountResult> DeleteAsync(int id)
    {
        var entity = await _db.AccountDailies.FindAsync(id);
        if (entity == null)
        {
            return new AccountResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的账户资金记录"
            };
        }

        _db.AccountDailies.Remove(entity);
        await _db.SaveChangesAsync();

        return new AccountResult
        {
            Success = true,
            Message = "账户资金记录删除成功"
        };
    }

    /// <summary>
    /// 按日期范围查询账户资金
    /// </summary>
    public async Task<List<AccountDailyResponse>> GetByDateRangeAsync(DateTime? startDate, DateTime? endDate)
    {
        var query = _db.AccountDailies.AsNoTracking();

        if (startDate.HasValue)
        {
            var start = startDate.Value.Date;
            query = query.Where(a => a.Date >= start);
        }

        if (endDate.HasValue)
        {
            var end = endDate.Value.Date;
            query = query.Where(a => a.Date <= end);
        }

        var list = await query
            .OrderBy(a => a.Date)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    /// <summary>
    /// 获取最新一条账户资金记录
    /// </summary>
    public async Task<AccountDailyResponse?> GetLatestAsync()
    {
        var entity = await _db.AccountDailies
            .AsNoTracking()
            .OrderByDescending(a => a.Date)
            .FirstOrDefaultAsync();

        return entity == null ? null : ToResponse(entity);
    }

    /// <summary>
    /// 根据 ID 获取账户资金记录
    /// </summary>
    public async Task<AccountDailyResponse?> GetByIdAsync(int id)
    {
        var entity = await _db.AccountDailies
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        return entity == null ? null : ToResponse(entity);
    }

    /// <summary>
    /// 将实体映射为响应 DTO
    /// </summary>
    private static AccountDailyResponse ToResponse(AccountDaily entity)
    {
        return new AccountDailyResponse
        {
            Id = entity.Id,
            Date = entity.Date,
            TotalAssets = entity.TotalAssets,
            PositionValue = entity.PositionValue,
            AvailableFunds = entity.AvailableFunds,
            DailyPnL = entity.DailyPnL,
            Remark = entity.Remark
        };
    }
}
