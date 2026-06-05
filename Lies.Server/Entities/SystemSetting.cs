using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lies.Server.Entities;

[Table("system_settings")]
public class SystemSetting
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("setting_key")]
    public string SettingKey { get; set; } = string.Empty;

    [Required]
    [Column("setting_value")]
    public string SettingValue { get; set; } = string.Empty;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_by_user_id")]
    public int? UpdatedByUserId { get; set; }

    [ForeignKey(nameof(UpdatedByUserId))]
    public virtual User? UpdatedByUser { get; set; }
}
