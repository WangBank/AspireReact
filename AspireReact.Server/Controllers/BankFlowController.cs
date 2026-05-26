using AspireReact.Server.DTOs;
using AspireReact.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

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
        var list = await _bankFlowService.GetByDateRangeAsync(startDate, endDate);

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
        var list = await _bankFlowService.GetRecentAsync();

        return Ok(new
        {
            success = true,
            data = list,
            message = $"查询到 {list.Count} 条最近记录"
        });
    }

    /// <summary>
    /// 新增银证流水记录
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BankFlowRequest request)
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

        var result = await _bankFlowService.CreateAsync(request);

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
        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                message = "参数验证失败",
                errors = ModelState
            });
        }

        var result = await _bankFlowService.UpdateAsync(id, request);

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
    /// 删除银证流水记录
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _bankFlowService.DeleteAsync(id);

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
