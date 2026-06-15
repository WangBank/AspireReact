using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("user_contacts")]
public class UserContact
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Column("owner_user_id")]
    public int OwnerUserId { get; set; }

    [Column("contact_user_id")]
    public int ContactUserId { get; set; }

    [MaxLength(100)]
    [Column("alias")]
    public string? Alias { get; set; }

    [Column("is_pinned")]
    public bool IsPinned { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(OwnerUserId))]
    public virtual User? OwnerUser { get; set; }

    [ForeignKey(nameof(ContactUserId))]
    public virtual User? ContactUser { get; set; }
}
