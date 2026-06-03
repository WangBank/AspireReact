using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Lies.Server.Services;

public static class AuthConfig
{
    private const int MinimumJwtSecretBytes = 32;

    public static string GetJwtSecret(IConfiguration configuration)
    {
        return configuration["Jwt:Secret"] ?? "your-secret-key-here-minimum-32-characters-long";
    }

    public static SymmetricSecurityKey CreateJwtSecurityKey(IConfiguration configuration)
    {
        var secret = GetJwtSecret(configuration);
        var keyBytes = Encoding.UTF8.GetBytes(secret);

        if (keyBytes.Length < MinimumJwtSecretBytes)
        {
            throw new InvalidOperationException(
                $"JWT secret is too short for HS256. It must be at least {MinimumJwtSecretBytes} bytes, but the current value is {keyBytes.Length} bytes. Update Jwt:Secret or the JWT_SECRET/Jwt__Secret environment variable.");
        }

        return new SymmetricSecurityKey(keyBytes);
    }

    public static void ValidateJwtConfiguration(IConfiguration configuration)
    {
        _ = CreateJwtSecurityKey(configuration);
    }

    public static string GetJwtIssuer(IConfiguration configuration)
    {
        return configuration["Jwt:Issuer"] ?? "Lies.Server";
    }

    public static string GetJwtAudience(IConfiguration configuration)
    {
        return configuration["Jwt:Audience"] ?? "Lies.Client";
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
