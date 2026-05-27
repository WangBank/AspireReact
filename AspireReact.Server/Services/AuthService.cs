using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AspireReact.Server.Data;
using AspireReact.Server.DTOs;
using AspireReact.Server.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AspireReact.Server.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly ICaptchaService _captchaService;
    private readonly IConfiguration _configuration;

    public AuthService(AppDbContext db, ICaptchaService captchaService, IConfiguration configuration)
    {
        _db = db;
        _captchaService = captchaService;
        _configuration = configuration;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
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

        // 生成JWT
        var token = GenerateJwtToken(user);

        return new AuthResponse
        {
            Success = true,
            Message = "注册成功",
            Token = token,
            Username = user.Username
        };
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

        // 更新最后登录时间
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var token = GenerateJwtToken(user);

        return new AuthResponse
        {
            Success = true,
            Message = "登录成功",
            Token = token,
            Username = user.Username
        };
    }

    private string GenerateJwtToken(User user)
    {
        var secret = AuthConfig.GetJwtSecret(_configuration);
        var issuer = AuthConfig.GetJwtIssuer(_configuration);
        var audience = AuthConfig.GetJwtAudience(_configuration);
        var expiryMinutes = AuthConfig.GetJwtExpiryMinutes(_configuration);

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
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
}