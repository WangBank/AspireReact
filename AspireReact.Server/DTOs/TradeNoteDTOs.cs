using System.ComponentModel.DataAnnotations;

namespace AspireReact.Server.DTOs;

/// <summary>
/// 新增/修改笔记请求
/// </summary>
public class NoteRequest
{
    [Required(ErrorMessage = "日期不能为空")]
    public DateTime Date { get; set; }

    /// <summary>
    /// 股票代码（可选，为空时表示全局笔记）
    /// </summary>
    [MaxLength(10, ErrorMessage = "股票代码最多10个字符")]
    public string? StockCode { get; set; }

    [Required(ErrorMessage = "笔记内容不能为空")]
    [MaxLength(10000, ErrorMessage = "笔记内容最多10000个字符")]
    public string Content { get; set; } = string.Empty;
}

/// <summary>
/// 笔记响应
/// </summary>
public class NoteResponse
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string? StockCode { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// 笔记操作结果
/// </summary>
public class NoteResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public NoteResponse? Data { get; set; }
}