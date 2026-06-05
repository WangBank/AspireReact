using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Services;

public class BankFlowService : IBankFlowService
{
    private readonly AppDbContext _db;
    private readonly ISensitiveWordService _sensitiveWordService;

    public BankFlowService(AppDbContext db, ISensitiveWordService sensitiveWordService)
    {
        _db = db;
        _sensitiveWordService = sensitiveWordService;
    }

    /// <summary>
    /// 新增流水记录
    /// </summary>
    public async Task<BankFlowResult> CreateAsync(int userId, BankFlowRequest request)
    {
        var validation = await _sensitiveWordService.ValidateAsync(
        [
            new SensitiveWordInput("银证备注", request.Remark)
        ]);
        if (!validation.IsValid)
        {
            return new BankFlowResult
            {
                Success = false,
                Message = validation.Message,
                ErrorCode = "validation"
            };
        }

        var entity = new BankFlow
        {
            UserId = userId,
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
    public async Task<BankFlowResult> UpdateAsync(int userId, int id, BankFlowRequest request)
    {
        var validation = await _sensitiveWordService.ValidateAsync(
        [
            new SensitiveWordInput("银证备注", request.Remark)
        ]);
        if (!validation.IsValid)
        {
            return new BankFlowResult
            {
                Success = false,
                Message = validation.Message,
                ErrorCode = "validation"
            };
        }

        var entity = await _db.BankFlows.FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId);
        if (entity == null)
        {
            return new BankFlowResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的银证流水记录",
                ErrorCode = "not_found"
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
    public async Task<BankFlowResult> DeleteAsync(int userId, int id)
    {
        var entity = await _db.BankFlows.FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId);
        if (entity == null)
        {
            return new BankFlowResult
            {
                Success = false,
                Message = $"未找到 ID 为 {id} 的银证流水记录",
                ErrorCode = "not_found"
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
    public async Task<List<BankFlowResponse>> GetByDateRangeAsync(int userId, DateTime? startDate, DateTime? endDate)
    {
        var query = _db.BankFlows
            .AsNoTracking()
            .Where(item => item.UserId == userId);

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
    public async Task<List<BankFlowResponse>> GetRecentAsync(int userId)
    {
        var list = await _db.BankFlows
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderByDescending(b => b.CreatedAt)
            .Take(10)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    /// <summary>
    /// 根据 ID 获取银证流水记录
    /// </summary>
    public async Task<BankFlowResponse?> GetByIdAsync(int userId, int id)
    {
        var entity = await _db.BankFlows
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        return entity == null ? null : ToResponse(entity);
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
