using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("message_conversations")]
public class MessageConversation
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(64)]
    [Column("pair_key")]
    public string PairKey { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_message_at")]
    public DateTime? LastMessageAt { get; set; }

    [MaxLength(500)]
    [Column("last_message_preview")]
    public string? LastMessagePreview { get; set; }

    [MaxLength(16)]
    [Column("last_message_type")]
    public string? LastMessageType { get; set; }

    public virtual ICollection<MessageConversationParticipant>? Participants { get; set; }
    public virtual ICollection<UserMessage>? Messages { get; set; }
}
