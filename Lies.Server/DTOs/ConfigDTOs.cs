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
}
