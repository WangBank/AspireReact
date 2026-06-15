using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("message_conversation_participants")]
public class MessageConversationParticipant
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Column("conversation_id")]
    public int ConversationId { get; set; }

    [Column("user_id")]
    public int UserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_read_message_id")]
    public int? LastReadMessageId { get; set; }

    [Column("last_read_at")]
    public DateTime? LastReadAt { get; set; }

    [Column("is_pinned")]
    public bool IsPinned { get; set; }

    [Column("is_muted")]
    public bool IsMuted { get; set; }

    public virtual MessageConversation? Conversation { get; set; }
    public virtual User? User { get; set; }
}
