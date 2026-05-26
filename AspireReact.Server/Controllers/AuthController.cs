using AspireReact.Server.DTOs;
using AspireReact.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AspireReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
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
            data = new { token = result.Token, username = result.Username },
            message = result.Message
        });
    }

    /// <summary>
    /// 用户登录
    /// </summary>
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
            data = new { token = result.Token, username = result.Username },
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
}