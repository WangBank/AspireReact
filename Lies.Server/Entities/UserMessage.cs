using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("user_messages")]
public class UserMessage
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Column("conversation_id")]
    public int ConversationId { get; set; }

    [Column("sender_user_id")]
    public int SenderUserId { get; set; }

    [Required]
    [MaxLength(16)]
    [Column("message_type")]
    public string MessageType { get; set; } = "text";

    [MaxLength(4000)]
    [Column("text_content")]
    public string? TextContent { get; set; }

    [MaxLength(500)]
    [Column("image_url")]
    public string? ImageUrl { get; set; }

    [MaxLength(255)]
    [Column("image_file_name")]
    public string? ImageFileName { get; set; }

    [Column("reply_to_message_id")]
    public int? ReplyToMessageId { get; set; }

    [Column("is_recalled")]
    public bool IsRecalled { get; set; }

    [Column("recalled_at")]
    public DateTime? RecalledAt { get; set; }

    [Column("recalled_by_user_id")]
    public int? RecalledByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual MessageConversation? Conversation { get; set; }

    [ForeignKey(nameof(SenderUserId))]
    public virtual User? SenderUser { get; set; }

    [ForeignKey(nameof(ReplyToMessageId))]
    public virtual UserMessage? ReplyToMessage { get; set; }

    public virtual ICollection<UserMessage>? Replies { get; set; }
}
