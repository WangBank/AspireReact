using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("user_friend_requests")]
public class UserFriendRequest
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Column("requester_user_id")]
    public int RequesterUserId { get; set; }

    [Column("target_user_id")]
    public int TargetUserId { get; set; }

    [MaxLength(200)]
    [Column("request_message")]
    public string? RequestMessage { get; set; }

    [MaxLength(100)]
    [Column("requester_alias")]
    public string? RequesterAlias { get; set; }

    [MaxLength(32)]
    [Column("status")]
    public string Status { get; set; } = "pending";

    [MaxLength(50)]
    [Column("source")]
    public string Source { get; set; } = "站内搜索";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("responded_at")]
    public DateTime? RespondedAt { get; set; }

    [ForeignKey(nameof(RequesterUserId))]
    public virtual User? RequesterUser { get; set; }

    [ForeignKey(nameof(TargetUserId))]
    public virtual User? TargetUser { get; set; }
}
