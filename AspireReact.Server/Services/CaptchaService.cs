using System.Security.Cryptography;
using System.Text;
using AspireReact.Server.Data;
using AspireReact.Server.Entities;

namespace AspireReact.Server.Services;

public interface ICaptchaService
{
    Task<Captcha> GenerateCaptchaAsync();
    Task<bool> ValidateCaptchaAsync(string captchaId, string code);
}

public class CaptchaService : ICaptchaService
{
    private readonly IRedisService _redis;
    private readonly IConfiguration _configuration;

    public CaptchaService(IRedisService redis, IConfiguration configuration)
    {
        _redis = redis;
        _configuration = configuration;
    }

    public async Task<Captcha> GenerateCaptchaAsync()
    {
        var captcha = new Captcha
        {
            Code = GenerateRandomCode(4),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(AuthConfig.GetCaptchaExpiryMinutes(_configuration))
        };

        var key = string.Format(RedisConfig.CacheKeys.Captcha, captcha.Id);
        var expiry = TimeSpan.FromMinutes(AuthConfig.GetCaptchaExpiryMinutes(_configuration));
        await _redis.SetAsync(key, captcha, expiry);

        return captcha;
    }

    public async Task<bool> ValidateCaptchaAsync(string captchaId, string code)
    {
        if (string.IsNullOrEmpty(captchaId) || string.IsNullOrEmpty(code))
            return false;

        var key = string.Format(RedisConfig.CacheKeys.Captcha, captchaId);
        var captcha = await _redis.GetAsync<Captcha>(key);

        if (captcha == null)
            return false;

        if (!captcha.IsValid)
        {
            await _redis.RemoveAsync(key);
            return false;
        }

        bool isValid = string.Equals(captcha.Code, code, StringComparison.OrdinalIgnoreCase);

        // 使用后立即删除验证码
        await _redis.RemoveAsync(key);

        return isValid;
    }

    private static string GenerateRandomCode(int length)
    {
        var bytes = new byte[length];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);

        var sb = new StringBuilder(length);
        foreach (var b in bytes)
        {
            sb.Append(b % 10); // 数字 0-9
        }
        return sb.ToString();
    }
}