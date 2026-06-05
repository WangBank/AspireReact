using System.ComponentModel.DataAnnotations;

namespace Lies.Server.DTOs;

/// <summary>
/// 修改同花顺链接前缀配置请求
/// </summary>
public class ConfigUpdateRequest
{
    /// <summary>
    /// 同花顺链接前缀，如 https://www.10jqka.com.cn/
    /// </summary>
    [Required(ErrorMessage = "同花顺链接前缀不能为空")]
    [MaxLength(500, ErrorMessage = "链接前缀最多500个字符")]
    public string TonghuashunLinkPrefix { get; set; } = string.Empty;

    /// <summary>
    /// 敏感词配置，支持换行/逗号分隔
    /// </summary>
    [MaxLength(20000, ErrorMessage = "敏感词配置最多20000个字符")]
    public string SensitiveWordsText { get; set; } = string.Empty;
}

/// <summary>
/// 配置管理响应
/// </summary>
public class ConfigResponse
{
    /// <summary>
    /// 同花顺链接前缀
    /// </summary>
    public string TonghuashunLinkPrefix { get; set; } = string.Empty;

    /// <summary>
    /// 敏感词配置文本，按行分隔
    /// </summary>
    public string SensitiveWordsText { get; set; } = string.Empty;

    /// <summary>
    /// 当前启用的敏感词数量
    /// </summary>
    public int SensitiveWordCount { get; set; }

    public DateTime? SensitiveWordsUpdatedAt { get; set; }

    public string? SensitiveWordsUpdatedByUsername { get; set; }
}
