using System;

namespace AspireReact.Server.Entities;

/// <summary>
/// 验证码实体，存储在Redis中
/// </summary>
public class Captcha
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Code { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; } = false;

    public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    public bool IsValid => !IsExpired && !IsUsed;
}