using Lies.Server.DTOs;
using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly HashSet<string> AllowedAvatarContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp"
    };

    private readonly IAuthService _authService;
    private readonly ICaptchaService _captchaService;

    public AuthController(IAuthService authService, ICaptchaService captchaService)
    {
        _authService = authService;
        _captchaService = captchaService;
    }

    /// <summary>
    /// 获取图形验证码（返回Base64图片和验证码ID）
    /// </summary>
    [AllowAnonymous]
    [HttpGet("captcha")]
    public async Task<IActionResult> GetCaptcha()
    {
        var captcha = await _captchaService.GenerateCaptchaAsync();

        // 生成简单SVG验证码图片
        var svg = GenerateCaptchaSvg(captcha.Code);

        return Ok(new
        {
            success = true,
            data = new
            {
                captchaId = captcha.Id,
                captchaImage = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(svg))
            },
            message = "验证码生成成功"
        });
    }

    /// <summary>
    /// 用户注册
    /// </summary>
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        var result = await _authService.RegisterAsync(request);

        if (!result.Success)
        {
            return BadRequest(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            data = new
            {
                token = result.Token,
                username = result.Username,
                role = result.Role,
                isAdmin = result.IsAdmin,
                avatarUrl = result.AvatarUrl
            },
            message = result.Message
        });
    }

    /// <summary>
    /// 用户登录
    /// </summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        var result = await _authService.LoginAsync(request);

        if (!result.Success)
        {
            return Unauthorized(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            data = new
            {
                token = result.Token,
                username = result.Username,
                role = result.Role,
                isAdmin = result.IsAdmin,
                avatarUrl = result.AvatarUrl
            },
            message = result.Message
        });
    }

    private static string GenerateCaptchaSvg(string code)
    {
        var chars = code.ToCharArray();
        var sb = new System.Text.StringBuilder();

        sb.Append("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"50\" style=\"background:#f0f0f0;\">");
        sb.Append("<rect width=\"120\" height=\"50\" fill=\"#f0f0f0\" rx=\"5\"/>");

        // 干扰线
        var rng = new Random();
        for (int i = 0; i < 3; i++)
        {
            var x1 = rng.Next(0, 40);
            var y1 = rng.Next(5, 45);
            var x2 = rng.Next(80, 120);
            var y2 = rng.Next(5, 45);
            sb.Append($"<line x1=\"{x1}\" y1=\"{y1}\" x2=\"{x2}\" y2=\"{y2}\" stroke=\"#ccc\" stroke-width=\"1\"/>");
        }

        // 数字
        for (int i = 0; i < chars.Length; i++)
        {
            var x = 15 + i * 25;
            var y = 20 + rng.Next(-5, 5);
            var rotation = rng.Next(-15, 15);
            var color = $"#{rng.Next(0, 128):X2}{rng.Next(0, 128):X2}{rng.Next(0, 128):X2}";
            sb.Append($"<text x=\"{x}\" y=\"{y}\" font-size=\"22\" font-family=\"Arial\" fill=\"{color}\" transform=\"rotate({rotation},{x + 10},{y - 8})\">{chars[i]}</text>");
        }

        sb.Append("</svg>");
        return sb.ToString();
    }

    /// <summary>
    /// 获取当前用户个人信息
    /// </summary>
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var userId = this.GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "未登录或Token无效" });

        var profile = await _authService.GetProfileAsync(userId.Value);
        if (profile == null)
            return NotFound(new { success = false, message = "用户不存在" });

        return Ok(new { success = true, data = profile, message = "获取个人信息成功" });
    }

    /// <summary>
    /// 更新个人信息（用户名、邮箱）
    /// </summary>
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });

        var userId = this.GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "未登录或Token无效" });

        var result = await _authService.UpdateProfileAsync(userId.Value, request);

        if (!result.Success)
            return BadRequest(new { success = false, message = result.Message });

        return Ok(new { success = true, data = new { username = result.Username, email = result.Email }, message = result.Message });
    }

    /// <summary>
    /// 修改密码
    /// </summary>
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });

        var userId = this.GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "未登录或Token无效" });

        var result = await _authService.ChangePasswordAsync(userId.Value, request);

        if (!result.Success)
            return BadRequest(new { success = false, message = result.Message });

        return Ok(new { success = true, message = result.Message });
    }

    [HttpPost("profile/avatar")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UpdateAvatar([FromForm] IFormFile avatar, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { success = false, message = "未登录或Token无效" });
        }

        if (avatar == null || avatar.Length == 0)
        {
            return BadRequest(new { success = false, message = "请上传头像图片" });
        }

        if (!string.IsNullOrWhiteSpace(avatar.ContentType)
            && !AllowedAvatarContentTypes.Contains(avatar.ContentType))
        {
            return BadRequest(new { success = false, message = "头像仅支持 PNG、JPG、JPEG、WebP 格式" });
        }

        var profile = await _authService.UpdateAvatarAsync(userId.Value, avatar, cancellationToken);
        if (profile == null)
        {
            return NotFound(new { success = false, message = "用户不存在或已被禁用" });
        }

        return Ok(new
        {
            success = true,
            data = profile,
            message = "头像更新成功"
        });
    }
}
