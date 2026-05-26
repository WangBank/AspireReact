using AspireReact.Server.DTOs;
using AspireReact.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NoteController : ControllerBase
{
    private readonly ITradeNoteService _noteService;

    public NoteController(ITradeNoteService noteService)
    {
        _noteService = noteService;
    }

    /// <summary>
    /// 按条件搜索笔记
    /// 支持 ?date=2026-05-26&amp;stockCode=000001&amp;keyword=复盘
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] DateTime? date = null,
        [FromQuery] string? stockCode = null,
        [FromQuery] string? keyword = null)
    {
        var list = await _noteService.SearchAsync(date, stockCode, keyword);

        return Ok(new
        {
            success = true,
            data = list,
            message = $"查询到 {list.Count} 条笔记"
        });
    }

    /// <summary>
    /// 获取全局笔记（StockCode 为空）
    /// </summary>
    [HttpGet("global")]
    public async Task<IActionResult> GetGlobal()
    {
        var list = await _noteService.GetGlobalNotesAsync();

        return Ok(new
        {
            success = true,
            data = list,
            message = $"查询到 {list.Count} 条全局笔记"
        });
    }

    /// <summary>
    /// 获取指定股票的笔记
    /// </summary>
    [HttpGet("stock/{stockCode}")]
    public async Task<IActionResult> GetByStockCode(string stockCode)
    {
        var list = await _noteService.GetByStockCodeAsync(stockCode);

        return Ok(new
        {
            success = true,
            data = list,
            message = $"查询到 {list.Count} 条股票 {stockCode} 的笔记"
        });
    }

    /// <summary>
    /// 新增笔记
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] NoteRequest request)
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

        var result = await _noteService.CreateAsync(request);

        return CreatedAtAction(nameof(Search), null, new
        {
            success = true,
            data = result.Data,
            message = result.Message
        });
    }

    /// <summary>
    /// 修改笔记
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] NoteRequest request)
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

        var result = await _noteService.UpdateAsync(id, request);

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
    /// 删除笔记
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _noteService.DeleteAsync(id);

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