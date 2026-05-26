using System.ComponentModel.DataAnnotations;

namespace AspireReact.Server.DTOs;

/// <summary>
/// 新增/修改账户资金请求
/// </summary>
public class AccountDailyRequest
{
    [Required(ErrorMessage = "日期不能为空")]
    public DateTime Date { get; set; }

    [Range(0, 9999999999.99, ErrorMessage = "总资产必须为正数")]
    public decimal TotalAssets { get; set; }

    [Range(0, 9999999999.99, ErrorMessage = "持仓市值必须为非负数")]
    public decimal PositionValue { get; set; }

    [Range(0, 9999999999.99, ErrorMessage = "可用资金必须为非负数")]
    public decimal AvailableFunds { get; set; }

    [Range(-9999999999.99, 9999999999.99, ErrorMessage = "当日盈亏范围不合法")]
    public decimal DailyPnL { get; set; }

    /// <summary>
    /// 备注（可选）
    /// </summary>
    [MaxLength(500, ErrorMessage = "备注最多500个字符")]
    public string? Remark { get; set; }
}

/// <summary>
/// 账户资金响应
/// </summary>
public class AccountDailyResponse
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public decimal TotalAssets { get; set; }
    public decimal PositionValue { get; set; }
    public decimal AvailableFunds { get; set; }
    public decimal DailyPnL { get; set; }
    public string? Remark { get; set; }
}

/// <summary>
/// 日期范围查询请求
/// </summary>
public class AccountDateRangeRequest
{
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
