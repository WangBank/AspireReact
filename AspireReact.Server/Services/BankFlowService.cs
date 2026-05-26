using AspireReact.Server.Data;
using AspireReact.Server.DTOs;
using AspireReact.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace AspireReact.Server.Services;

public class BankFlowService : IBankFlowService
{
    private readonly AppDbContext _db;

    public BankFlowService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// 新增流水记录
    /// </summary>
    public async Task<BankFlowResult> CreateAsync(BankFlowRequest request)
    {
        var entity = new BankFlow
        {
            Date = request.Date.Date,
            FlowType = request.FlowType,
            Amount = request.Amount,
            Remark = request.Remark,
            CreatedAt = DateTime.Now
        };

        _db.BankFlows.Add(entity);
        await _db.SaveChangesAsync();

        return new BankFlowResult
        {
            Success = true,
            Message = "银证流水记录添加成功",
            Data = ToResponse(entity)
        };
    }

    /// <summary>
    /// 修改流水记录
    /// </summary>
    public async Task<BankFlowResult> UpdateAsync(int id, BankFlowRequest request)
    {
        var entity = await _db.BankFlows.FindAsync(id);
        if (entity == null)
        {
            return new BankFlowResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的银证流水记录"
            };
        }

        entity.Date = request.Date.Date;
        entity.FlowType = request.FlowType;
        entity.Amount = request.Amount;
        entity.Remark = request.Remark;

        await _db.SaveChangesAsync();

        return new BankFlowResult
        {
            Success = true,
            Message = "银证流水记录修改成功",
            Data = ToResponse(entity)
        };
    }

    /// <summary>
    /// 删除流水记录
    /// </summary>
    public async Task<BankFlowResult> DeleteAsync(int id)
    {
        var entity = await _db.BankFlows.FindAsync(id);
        if (entity == null)
        {
            return new BankFlowResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的银证流水记录"
            };
        }

        _db.BankFlows.Remove(entity);
        await _db.SaveChangesAsync();

        return new BankFlowResult
        {
            Success = true,
            Message = "银证流水记录删除成功"
        };
    }

    /// <summary>
    /// 按日期范围查询流水
    /// </summary>
    public async Task<List<BankFlowResponse>> GetByDateRangeAsync(DateTime? startDate, DateTime? endDate)
    {
        var query = _db.BankFlows.AsNoTracking();

        if (startDate.HasValue)
        {
            var start = startDate.Value.Date;
            query = query.Where(b => b.Date >= start);
        }

        if (endDate.HasValue)
        {
            var end = endDate.Value.Date;
            query = query.Where(b => b.Date <= end);
        }

        var list = await query
            .OrderByDescending(b => b.Date)
            .ThenByDescending(b => b.CreatedAt)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    /// <summary>
    /// 获取最近10条流水
    /// </summary>
    public async Task<List<BankFlowResponse>> GetRecentAsync()
    {
        var list = await _db.BankFlows
            .AsNoTracking()
            .OrderByDescending(b => b.CreatedAt)
            .Take(10)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    /// <summary>
    /// 将实体映射为响应 DTO
    /// </summary>
    private static BankFlowResponse ToResponse(BankFlow entity)
    {
        return new BankFlowResponse
        {
            Id = entity.Id,
            Date = entity.Date,
            FlowType = entity.FlowType,
            Amount = entity.Amount,
            Remark = entity.Remark,
            CreatedAt = entity.CreatedAt
        };
    }
}
