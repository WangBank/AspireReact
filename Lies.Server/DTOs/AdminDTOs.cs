using System.ComponentModel.DataAnnotations;

namespace Lies.Server.DTOs;

public class AdminSummaryResponse
{
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int AdminUsers { get; set; }
    public int TotalAccounts { get; set; }
    public int TotalBankFlows { get; set; }
    public int TotalTrades { get; set; }
    public int TotalAudits { get; set; }
    public DateTime? LastUserLoginAt { get; set; }
    public DateTime? LastAuditCreatedAt { get; set; }
}

public class AdminUserListItemResponse
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public AdminUserPerformanceResponse Performance { get; set; } = new();
}

public class AdminUserPerformanceResponse
{
    public DateTime? LatestDataDate { get; set; }
    public int AccountRecordCount { get; set; }
    public int BankFlowRecordCount { get; set; }
    public int TradeRecordCount { get; set; }
    public decimal CurrentTotalAssets { get; set; }
    public decimal LatestDailyPnL { get; set; }
    public decimal TotalPnL { get; set; }
    public decimal RealizedPnL { get; set; }
    public decimal UnrealizedPnL { get; set; }
    public decimal NetBankFlow { get; set; }
    public int WinTrades { get; set; }
    public int LoseTrades { get; set; }
    public int TotalTrades { get; set; }
    public decimal WinRate { get; set; }
}

public class AdminUserStatusUpdateRequest
{
    public bool IsActive { get; set; }
}

public class AdminUserRoleUpdateRequest
{
    [Required(ErrorMessage = "角色不能为空")]
    [RegularExpression("^(Admin|User)$", ErrorMessage = "角色只能是 Admin 或 User")]
    public string Role { get; set; } = "User";
}

public class AdminUserPasswordResetRequest
{
    [Required(ErrorMessage = "新密码不能为空")]
    [MinLength(6, ErrorMessage = "新密码至少 6 个字符")]
    [MaxLength(100, ErrorMessage = "新密码最多 100 个字符")]
    public string NewPassword { get; set; } = string.Empty;
}

public class AdminUserBatchStatusUpdateRequest
{
    [Required(ErrorMessage = "请选择至少一个用户")]
    [MinLength(1, ErrorMessage = "请选择至少一个用户")]
    public List<int> UserIds { get; set; } = [];

    public bool IsActive { get; set; }
}

public class AdminUserBatchRoleUpdateRequest
{
    [Required(ErrorMessage = "请选择至少一个用户")]
    [MinLength(1, ErrorMessage = "请选择至少一个用户")]
    public List<int> UserIds { get; set; } = [];

    [Required(ErrorMessage = "角色不能为空")]
    [RegularExpression("^(Admin|User)$", ErrorMessage = "角色只能是 Admin 或 User")]
    public string Role { get; set; } = "User";
}

public class AdminBatchOperationResultResponse
{
    public int UpdatedCount { get; set; }
    public List<int> UserIds { get; set; } = [];
}

public class ReflectionContentResponse
{
    public string Content { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByUsername { get; set; }
}

public class ReflectionContentUpdateRequest
{
    [Required(ErrorMessage = "内容不能为空")]
    public string Content { get; set; } = string.Empty;
}
