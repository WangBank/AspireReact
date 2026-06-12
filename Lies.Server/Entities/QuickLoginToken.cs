using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("quick_login_tokens")]
public class QuickLoginToken
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("user_id")]
    public int UserId { get; set; }

    [Required]
    [MaxLength(64)]
    [Column("selector")]
    public string Selector { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    [Column("validator_hash")]
    public string ValidatorHash { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_used_at")]
    public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    public virtual User? User { get; set; }
}
