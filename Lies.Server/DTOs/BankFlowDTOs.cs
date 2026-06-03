using System.ComponentModel.DataAnnotations;

namespace Lies.Server.DTOs;

/// <summary>
/// 新增/修改银证流水请求
/// </summary>
public class BankFlowRequest
{
    [Required(ErrorMessage = "日期不能为空")]
    public DateTime Date { get; set; }

    [Required(ErrorMessage = "流水类型不能为空")]
    [RegularExpression("^(转入|转出)$", ErrorMessage = "流水类型必须为'转入'或'转出'")]
    public string FlowType { get; set; } = string.Empty;

    [Range(0.01, 9999999999.99, ErrorMessage = "金额必须大于0")]
    public decimal Amount { get; set; }

    /// <summary>
    /// 备注（可选）
    /// </summary>
    [MaxLength(500, ErrorMessage = "备注最多500个字符")]
    public string? Remark { get; set; }
}

/// <summary>
/// 银证流水响应
/// </summary>
public class BankFlowResponse
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string FlowType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Remark { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// 银证流水操作结果
/// </summary>
public class BankFlowResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public BankFlowResponse? Data { get; set; }
}
