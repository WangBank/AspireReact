using Lies.Server.DTOs;
using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BankFlowController : ControllerBase
{
    private readonly IBankFlowService _bankFlowService;

    public BankFlowController(IBankFlowService bankFlowService)
    {
        _bankFlowService = bankFlowService;
    }

    /// <summary>
    /// 按日期范围查询银证流水记录
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetByDateRange(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var guard = this.RequireCurrentUser(out var userId);
        if (guard != null)
        {
            return guard;
        }

        var list = await _bankFlowService.GetByDateRangeAsync(userId, startDate, endDate);

        return Ok(new
        {
            success = true,
            data = list,
            message = $"查询到 {list.Count} 条记录"
        });
    }

    /// <summary>
    /// 获取最近10条银证流水
    /// </summary>
    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent()
    {
        var guard = this.RequireCurrentUser(out var userId);
        if (guard != null)
        {
            return guard;
        }

        var list = await _bankFlowService.GetRecentAsync(userId);

        return Ok(new
        {
            success = true,
            data = list,
            message = $"查询到 {list.Count} 条最近记录"
        });
    }

    /// <summary>
    /// 根据 ID 获取银证流水记录
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var guard = this.RequireCurrentUser(out var userId);
        if (guard != null)
        {
            return guard;
        }

        var data = await _bankFlowService.GetByIdAsync(userId, id);

        if (data == null)
        {
            return NotFound(new
            {
                success = false,
                message = $"未找到 ID 为 {id} 的银证流水记录"
            });
        }

        return Ok(new
        {
            success = true,
            data,
            message = "获取记录成功"
        });
    }

    /// <summary>
    /// 新增银证流水记录
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BankFlowRequest request)
    {
        var guard = this.RequireCurrentUser(out var userId);
        if (guard != null)
        {
            return guard;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                message = "参数验证失败",
                errors = ModelState
            });
        }

        var result = await _bankFlowService.CreateAsync(userId, request);

        if (!result.Success)
        {
            return result.ErrorCode switch
            {
                "validation" => BadRequest(new { success = false, message = result.Message }),
                _ => BadRequest(new { success = false, message = result.Message })
            };
        }

        return CreatedAtAction(nameof(GetByDateRange), null, new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 修改银证流水记录
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] BankFlowRequest request)
    {
        var guard = this.RequireCurrentUser(out var userId);
        if (guard != null)
        {
            return guard;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                message = "参数验证失败",
                errors = ModelState
            });
        }

        var result = await _bankFlowService.UpdateAsync(userId, id, request);

        if (!result.Success)
        {
            return result.ErrorCode switch
            {
                "validation" => BadRequest(new { success = false, message = result.Message }),
                "not_found" => NotFound(new { success = false, message = result.Message }),
                _ => BadRequest(new { success = false, message = result.Message })
            };
        }

        return Ok(new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 删除银证流水记录
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var guard = this.RequireCurrentUser(out var userId);
        if (guard != null)
        {
            return guard;
        }

        var result = await _bankFlowService.DeleteAsync(userId, id);

        if (!result.Success)
        {
            return NotFound(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            message = result.Message
        });
    }
}
