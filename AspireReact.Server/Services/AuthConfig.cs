using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace AspireReact.Server.Services;

public static class AuthConfig
{
    public static string GetJwtSecret(IConfiguration configuration)
    {
        return configuration["Jwt:Secret"] ?? "your-secret-key-here-minimum-32-characters-long";
    }

    public static string GetJwtIssuer(IConfiguration configuration)
    {
        return configuration["Jwt:Issuer"] ?? "AspireReact.Server";
    }

    public static string GetJwtAudience(IConfiguration configuration)
    {
        return configuration["Jwt:Audience"] ?? "AspireReact.Client";
    }

    public static int GetJwtExpiryMinutes(IConfiguration configuration)
    {
        return int.TryParse(configuration["Jwt:ExpiryMinutes"], out int minutes) ? minutes : 60;
    }

    public static int GetCaptchaExpiryMinutes(IConfiguration configuration)
    {
        return int.TryParse(configuration["Captcha:ExpiryMinutes"], out int minutes) ? minutes : 5;
    }
}