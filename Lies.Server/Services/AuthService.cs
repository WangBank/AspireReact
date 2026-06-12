using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Lies.Server.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> QuickLoginAsync(QuickLoginRequest request);
    Task<UserProfileResponse?> GetProfileAsync(int userId);
    Task<UpdateProfileResponse> UpdateProfileAsync(int userId, UpdateProfileRequest request);
    Task<UpdateProfileResponse> ChangePasswordAsync(int userId, ChangePasswordRequest request);
    Task<UserProfileResponse?> UpdateAvatarAsync(int userId, IFormFile file, CancellationToken cancellationToken = default);
}

public class UpdateProfileResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string? Email { get; set; }
}

public class AuthService : IAuthService
{
    private const int MaxQuickLoginTokensPerUser = 5;
    private readonly AppDbContext _db;
    private readonly ICaptchaService _captchaService;
    private readonly ISensitiveWordService _sensitiveWordService;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public AuthService(
        AppDbContext db,
        ICaptchaService captchaService,
        ISensitiveWordService sensitiveWordService,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        _db = db;
        _captchaService = captchaService;
        _sensitiveWordService = sensitiveWordService;
        _configuration = configuration;
        _environment = environment;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var validation = await _sensitiveWordService.ValidateAsync(
        [
            new SensitiveWordInput("用户名", request.Username)
        ]);
        if (!validation.IsValid)
        {
            return new AuthResponse
            {
                Success = false,
                Message = validation.Message
            };
        }

        // 验证验证码
        var captchaValid = await _captchaService.ValidateCaptchaAsync(request.CaptchaId, request.CaptchaCode);
        if (!captchaValid)
        {
            return new AuthResponse { Success = false, Message = "验证码错误或已过期" };
        }

        // 检查用户名是否已存在
        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
        if (existingUser != null)
        {
            return new AuthResponse { Success = false, Message = "用户名已存在" };
        }

        // 检查邮箱是否已存在
        var existingEmail = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (existingEmail != null)
        {
            return new AuthResponse { Success = false, Message = "该邮箱已被注册" };
        }

        // 创建用户
        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return await FinalizeSignInAsync(user, "注册成功");
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
        if (user == null)
        {
            return new AuthResponse { Success = false, Message = "用户名或密码错误" };
        }

        if (!user.IsActive)
        {
            return new AuthResponse { Success = false, Message = "账户已被禁用" };
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return new AuthResponse { Success = false, Message = "用户名或密码错误" };
        }

        return await FinalizeSignInAsync(user, "登录成功");
    }

    public async Task<AuthResponse> QuickLoginAsync(QuickLoginRequest request)
    {
        var now = DateTime.UtcNow;
        var selector = request.Selector.Trim();
        var validator = request.Validator.Trim();

        if (string.IsNullOrWhiteSpace(selector) || string.IsNullOrWhiteSpace(validator))
        {
            return new AuthResponse { Success = false, Message = "快速登录凭据无效" };
        }

        var ticket = await _db.QuickLoginTokens
            .Include(item => item.User)
            .FirstOrDefaultAsync(item => item.Selector == selector);

        if (ticket == null)
        {
            return new AuthResponse { Success = false, Message = "快速登录凭据已失效，请重新输入账号密码登录" };
        }

        if (ticket.ExpiresAt <= now || !VerifyQuickLoginValidator(ticket.ValidatorHash, validator))
        {
            _db.QuickLoginTokens.Remove(ticket);
            await _db.SaveChangesAsync();
            return new AuthResponse { Success = false, Message = "快速登录凭据已失效，请重新输入账号密码登录" };
        }

        var user = ticket.User;
        if (user == null || !user.IsActive)
        {
            _db.QuickLoginTokens.Remove(ticket);
            await _db.SaveChangesAsync();
            return new AuthResponse { Success = false, Message = "账户不存在或已被禁用" };
        }

        return await FinalizeSignInAsync(user, "快速登录成功", ticket);
    }

    private string GenerateJwtToken(User user)
    {
        var issuer = AuthConfig.GetJwtIssuer(_configuration);
        var audience = AuthConfig.GetJwtAudience(_configuration);
        var expiryMinutes = AuthConfig.GetJwtExpiryMinutes(_configuration);

        var key = AuthConfig.CreateJwtSecurityKey(_configuration);
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<UserProfileResponse?> GetProfileAsync(int userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null || !user.IsActive)
            return null;

        return new UserProfileResponse
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Role = user.Role,
            IsAdmin = IsAdmin(user),
            AvatarUrl = NormalizeAssetUrl(user.AvatarPath),
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt
        };
    }

    public async Task<UpdateProfileResponse> UpdateProfileAsync(int userId, UpdateProfileRequest request)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null || !user.IsActive)
            return new UpdateProfileResponse { Success = false, Message = "用户不存在或已被禁用" };

        var validation = await _sensitiveWordService.ValidateAsync(
        [
            new SensitiveWordInput("用户名", request.Username)
        ]);
        if (!validation.IsValid)
        {
            return new UpdateProfileResponse
            {
                Success = false,
                Message = validation.Message
            };
        }

        // 检查用户名是否被其他用户占用
        var existingUsername = await _db.Users
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.Id != userId);
        if (existingUsername != null)
            return new UpdateProfileResponse { Success = false, Message = "用户名已存在" };

        // 检查邮箱是否被其他用户占用
        var existingEmail = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.Id != userId);
        if (existingEmail != null)
            return new UpdateProfileResponse { Success = false, Message = "该邮箱已被注册" };

        user.Username = request.Username;
        user.Email = request.Email;
        await _db.SaveChangesAsync();

        return new UpdateProfileResponse
        {
            Success = true,
            Message = "个人信息更新成功",
            Username = user.Username,
            Email = user.Email
        };
    }

    public async Task<UpdateProfileResponse> ChangePasswordAsync(int userId, ChangePasswordRequest request)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null || !user.IsActive)
            return new UpdateProfileResponse { Success = false, Message = "用户不存在或已被禁用" };

        // 验证当前密码
        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return new UpdateProfileResponse { Success = false, Message = "当前密码错误" };

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await RevokeQuickLoginTokensAsync(user.Id);
        await _db.SaveChangesAsync();

        return new UpdateProfileResponse { Success = true, Message = "密码修改成功" };
    }

    public async Task<UserProfileResponse?> UpdateAvatarAsync(int userId, IFormFile file, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FindAsync([userId], cancellationToken);
        if (user == null || !user.IsActive)
        {
            return null;
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".png";
        }

        var avatarsRoot = Path.Combine(
            _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"),
            "uploads",
            "avatars");
        Directory.CreateDirectory(avatarsRoot);

        var fileName = $"user-{user.Id}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}{extension.ToLowerInvariant()}";
        var absoluteFilePath = Path.Combine(avatarsRoot, fileName);

        await using (var stream = File.Create(absoluteFilePath))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        DeleteAvatarFileIfExists(user.AvatarPath);
        user.AvatarPath = $"/uploads/avatars/{fileName}";
        await _db.SaveChangesAsync(cancellationToken);

        return await GetProfileAsync(userId);
    }

    private async Task<AuthResponse> FinalizeSignInAsync(
        User user,
        string message,
        QuickLoginToken? rotatedToken = null,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        user.LastLoginAt = now;

        if (rotatedToken != null)
        {
            _db.QuickLoginTokens.Remove(rotatedToken);
        }

        var issuedQuickLogin = CreateQuickLoginToken(user.Id, now);
        _db.QuickLoginTokens.Add(issuedQuickLogin.Entity);
        await _db.SaveChangesAsync(cancellationToken);
        await TrimQuickLoginTokensAsync(user.Id, now, cancellationToken);

        return new AuthResponse
        {
            Success = true,
            Message = message,
            Token = GenerateJwtToken(user),
            Username = user.Username,
            Role = user.Role,
            IsAdmin = IsAdmin(user),
            AvatarUrl = NormalizeAssetUrl(user.AvatarPath),
            QuickLogin = new QuickLoginTokenResponse
            {
                Selector = issuedQuickLogin.Entity.Selector,
                Validator = issuedQuickLogin.Validator,
                ExpiresAt = issuedQuickLogin.Entity.ExpiresAt
            }
        };
    }

    private (QuickLoginToken Entity, string Validator) CreateQuickLoginToken(int userId, DateTime now)
    {
        var selector = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var validator = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        return (
            new QuickLoginToken
            {
                UserId = userId,
                Selector = selector,
                ValidatorHash = HashQuickLoginValidator(validator),
                CreatedAt = now,
                LastUsedAt = now,
                ExpiresAt = now.AddDays(GetQuickLoginExpiryDays())
            },
            validator
        );
    }

    private int GetQuickLoginExpiryDays()
    {
        if (int.TryParse(_configuration["Auth:QuickLoginExpiryDays"], out var configuredDays))
        {
            return Math.Clamp(configuredDays, 1, 365);
        }

        return 30;
    }

    private async Task TrimQuickLoginTokensAsync(int userId, DateTime now, CancellationToken cancellationToken)
    {
        var tokens = await _db.QuickLoginTokens
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.LastUsedAt)
            .ThenByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        var keepIds = tokens
            .Where(item => item.ExpiresAt > now)
            .Take(MaxQuickLoginTokensPerUser)
            .Select(item => item.Id)
            .ToHashSet();

        var tokensToRemove = tokens
            .Where(item => item.ExpiresAt <= now || !keepIds.Contains(item.Id))
            .ToList();

        if (tokensToRemove.Count == 0)
        {
            return;
        }

        _db.QuickLoginTokens.RemoveRange(tokensToRemove);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task RevokeQuickLoginTokensAsync(int userId, CancellationToken cancellationToken = default)
    {
        var tickets = await _db.QuickLoginTokens
            .Where(item => item.UserId == userId)
            .ToListAsync(cancellationToken);

        if (tickets.Count == 0)
        {
            return;
        }

        _db.QuickLoginTokens.RemoveRange(tickets);
    }

    private static string HashQuickLoginValidator(string validator)
    {
        return Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(validator)));
    }

    private static bool VerifyQuickLoginValidator(string expectedHash, string validator)
    {
        try
        {
            var actualHashBytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(validator));
            var expectedHashBytes = Convert.FromHexString(expectedHash);
            return CryptographicOperations.FixedTimeEquals(expectedHashBytes, actualHashBytes);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private void DeleteAvatarFileIfExists(string? relativeAvatarPath)
    {
        if (string.IsNullOrWhiteSpace(relativeAvatarPath))
        {
            return;
        }

        var normalized = relativeAvatarPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(
            _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"),
            normalized);

        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }
    }

    private static string? NormalizeAssetUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.StartsWith('/') ? value : $"/{value}";
    }

    private static bool IsAdmin(User user)
    {
        return string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase);
    }
}
