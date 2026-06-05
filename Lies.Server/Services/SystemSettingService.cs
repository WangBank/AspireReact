using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Services;

public interface ISystemSettingService
{
    Task<ReflectionContentResponse> GetReflectionContentAsync(CancellationToken cancellationToken = default);
    Task<ReflectionContentResponse> UpdateReflectionContentAsync(
        string content,
        int updatedByUserId,
        CancellationToken cancellationToken = default);
}

public static class SystemSettingKeys
{
    public const string ReflectionSource = "reflection_source";
    public const string SensitiveWords = "sensitive_words";
}

public class SystemSettingService : ISystemSettingService
{
    private readonly AppDbContext _db;

    public SystemSettingService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ReflectionContentResponse> GetReflectionContentAsync(CancellationToken cancellationToken = default)
    {
        var setting = await _db.SystemSettings
            .AsNoTracking()
            .Include(item => item.UpdatedByUser)
            .FirstOrDefaultAsync(item => item.SettingKey == SystemSettingKeys.ReflectionSource, cancellationToken);

        return new ReflectionContentResponse
        {
            Content = setting?.SettingValue ?? string.Empty,
            UpdatedAt = setting?.UpdatedAt,
            UpdatedByUsername = setting?.UpdatedByUser?.Username
        };
    }

    public async Task<ReflectionContentResponse> UpdateReflectionContentAsync(
        string content,
        int updatedByUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedContent = content.Replace("\r\n", "\n").Trim();
        var setting = await _db.SystemSettings
            .Include(item => item.UpdatedByUser)
            .FirstOrDefaultAsync(item => item.SettingKey == SystemSettingKeys.ReflectionSource, cancellationToken);

        if (setting == null)
        {
            setting = new SystemSetting
            {
                SettingKey = SystemSettingKeys.ReflectionSource,
                SettingValue = normalizedContent,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByUserId = updatedByUserId
            };

            _db.SystemSettings.Add(setting);
        }
        else
        {
            setting.SettingValue = normalizedContent;
            setting.UpdatedAt = DateTime.UtcNow;
            setting.UpdatedByUserId = updatedByUserId;
        }

        await _db.SaveChangesAsync(cancellationToken);

        var username = await _db.Users
            .AsNoTracking()
            .Where(user => user.Id == updatedByUserId)
            .Select(user => user.Username)
            .FirstOrDefaultAsync(cancellationToken);

        return new ReflectionContentResponse
        {
            Content = normalizedContent,
            UpdatedAt = setting.UpdatedAt,
            UpdatedByUsername = username
        };
    }
}
