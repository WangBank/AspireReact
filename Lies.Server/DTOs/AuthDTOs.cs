using System.ComponentModel.DataAnnotations;

namespace Lies.Server.DTOs;

public class RegisterRequest
{
    [Required(ErrorMessage = "用户名不能为空")]
    [MinLength(3, ErrorMessage = "用户名至少3个字符")]
    [MaxLength(50, ErrorMessage = "用户名最多50个字符")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "邮箱不能为空")]
    [EmailAddress(ErrorMessage = "邮箱格式不正确")]
    [MaxLength(100, ErrorMessage = "邮箱最多100个字符")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "密码不能为空")]
    [MinLength(6, ErrorMessage = "密码至少6个字符")]
    [MaxLength(100, ErrorMessage = "密码最多100个字符")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "确认密码不能为空")]
    [Compare("Password", ErrorMessage = "两次密码输入不一致")]
    public string ConfirmPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "验证码ID不能为空")]
    public string CaptchaId { get; set; } = string.Empty;

    [Required(ErrorMessage = "验证码不能为空")]
    public string CaptchaCode { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required(ErrorMessage = "用户名不能为空")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "密码不能为空")]
    public string Password { get; set; } = string.Empty;
}

public class QuickLoginRequest
{
    [Required(ErrorMessage = "快速登录标识不能为空")]
    public string Selector { get; set; } = string.Empty;

    [Required(ErrorMessage = "快速登录凭据不能为空")]
    public string Validator { get; set; } = string.Empty;
}

public class QuickLoginTokenResponse
{
    public string Selector { get; set; } = string.Empty;
    public string Validator { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Token { get; set; }
    public string? Username { get; set; }
    public string? Role { get; set; }
    public bool IsAdmin { get; set; }
    public string? AvatarUrl { get; set; }
    public QuickLoginTokenResponse? QuickLogin { get; set; }
}

public class CaptchaResponse
{
    public string CaptchaId { get; set; } = string.Empty;
    public string CaptchaImage { get; set; } = string.Empty;
}

public class UserProfileResponse
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public bool IsAdmin { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class UpdateProfileRequest
{
    [Required(ErrorMessage = "用户名不能为空")]
    [MinLength(3, ErrorMessage = "用户名至少3个字符")]
    [MaxLength(50, ErrorMessage = "用户名最多50个字符")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "邮箱不能为空")]
    [EmailAddress(ErrorMessage = "邮箱格式不正确")]
    [MaxLength(100, ErrorMessage = "邮箱最多100个字符")]
    public string Email { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    [Required(ErrorMessage = "当前密码不能为空")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "新密码不能为空")]
    [MinLength(6, ErrorMessage = "新密码至少6个字符")]
    [MaxLength(100, ErrorMessage = "新密码最多100个字符")]
    public string NewPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "确认密码不能为空")]
    [Compare("NewPassword", ErrorMessage = "两次密码输入不一致")]
    public string ConfirmPassword { get; set; } = string.Empty;
}
