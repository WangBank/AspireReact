using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("users")]
public class User
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("username")]
    public string Username { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    [Column("password_hash")]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    [Column("role")]
    public string Role { get; set; } = "User";

    [MaxLength(500)]
    [Column("avatar_path")]
    public string? AvatarPath { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_login_at")]
    public DateTime? LastLoginAt { get; set; }

    [Column("last_seen_at")]
    public DateTime? LastSeenAt { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    // 导航属性
    public virtual ICollection<StockTrade>? StockTrades { get; set; }
    public virtual ICollection<AccountDaily>? AccountDailies { get; set; }
    public virtual ICollection<BankFlow>? BankFlows { get; set; }
    public virtual ICollection<TradeNote>? TradeNotes { get; set; }
    public virtual ICollection<PortfolioImportAudit>? PortfolioImportAudits { get; set; }
    public virtual ICollection<QuickLoginToken>? QuickLoginTokens { get; set; }
    public virtual ICollection<UserContact>? OwnedContacts { get; set; }
    public virtual ICollection<UserContact>? ContactOfUsers { get; set; }
    public virtual ICollection<MessageConversationParticipant>? MessageConversationParticipants { get; set; }
    public virtual ICollection<UserMessage>? SentMessages { get; set; }
    public virtual ICollection<SystemSetting>? UpdatedSystemSettings { get; set; }
}
