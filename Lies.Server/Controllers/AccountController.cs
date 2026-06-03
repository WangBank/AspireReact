using Lies.Server.DTOs;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AccountController : ControllerBase
{
    private readonly IAccountService _accountService;

    public AccountController(IAccountService accountService)
    {
        _accountService = accountService;
    }

    /// <summary>
    /// 按日期范围查询账户资金记录
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetByDateRange(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var list = await _accountService.GetByDateRangeAsync(startDate, endDate);

        return Ok(new
        {
            success = true,
            data = list,
            message = $"查询到 {list.Count} 条记录"
        });
    }

    /// <summary>
    /// 获取最新一条账户资金记录
    /// </summary>
    [HttpGet("latest")]
    public async Task<IActionResult> GetLatest()
    {
        var data = await _accountService.GetLatestAsync();

        if (data == null)
        {
            return Ok(new
            {
                success = true,
                data = (object?)null,
                message = "暂无账户资金记录"
            });
        }

        return Ok(new
        {
            success = true,
            data,
            message = "获取最新记录成功"
        });
    }

    /// <summary>
    /// 根据 ID 获取账户资金记录
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var data = await _accountService.GetByIdAsync(id);

        if (data == null)
        {
            return NotFound(new
            {
                success = false,
                message = $"未找到 ID 为 {id} 的账户资金记录"
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
    /// 新增当日账户资金
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AccountDailyRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                message = "参数验证失败",
                errors = ModelState
            });
        }

        var result = await _accountService.CreateAsync(request);

        if (!result.Success)
        {
            return Conflict(new { success = false, message = result.Message });
        }

        return CreatedAtAction(nameof(GetByDateRange), null, new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 修改账户资金记录
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] AccountDailyRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                message = "参数验证失败",
                errors = ModelState
            });
        }

        var result = await _accountService.UpdateAsync(id, request);

        if (!result.Success)
        {
            return NotFound(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 删除账户资金记录
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _accountService.DeleteAsync(id);

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