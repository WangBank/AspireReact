using System.ComponentModel.DataAnnotations;

namespace AspireReact.Server.DTOs;

public class RegisterRequest
{
    [Required(ErrorMessage = "用户名不能为空")]
    [MinLength(3, ErrorMessage = "用户名至少3个字符")]
    [MaxLength(50, ErrorMessage = "用户名最多50个字符")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "密码不能为空")]
    [MinLength(6, ErrorMessage = "密码至少6个字符")]
    [MaxLength(100, ErrorMessage = "密码最多100个字符")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "验证码不能为空")]
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

public class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Token { get; set; }
    public string? Username { get; set; }
}

public class CaptchaResponse
{
    public string CaptchaId { get; set; } = string.Empty;
    public string CaptchaImage { get; set; } = string.Empty;
}