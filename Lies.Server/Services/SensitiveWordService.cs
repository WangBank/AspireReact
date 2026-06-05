using Lies.Server.Data;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Services;

public interface ISensitiveWordService
{
    Task<SensitiveWordValidationResult> ValidateAsync(
        IEnumerable<SensitiveWordInput> inputs,
        CancellationToken cancellationToken = default);

    Task<SensitiveWordsConfiguration> GetConfigurationAsync(CancellationToken cancellationToken = default);

    Task<SensitiveWordsConfiguration> UpdateConfigurationAsync(
        string rawText,
        int updatedByUserId,
        CancellationToken cancellationToken = default);
}

public sealed record SensitiveWordInput(string FieldName, string? Value);

public sealed class SensitiveWordValidationResult
{
    public bool IsValid { get; init; } = true;
    public List<string> Violations { get; init; } = [];

    public string Message => Violations.Count == 0
        ? string.Empty
        : $"内容包含敏感词：{string.Join("；", Violations)}";
}

public sealed class SensitiveWordsConfiguration
{
    public string SensitiveWordsText { get; init; } = string.Empty;
    public IReadOnlyList<string> SensitiveWords { get; init; } = [];
    public int SensitiveWordCount { get; init; }
    public DateTime? UpdatedAt { get; init; }
    public string? UpdatedByUsername { get; init; }
}

public class SensitiveWordService(AppDbContext db) : ISensitiveWordService
{
    private static readonly string[] DefaultSensitiveWords =
    [
        "操你妈",
        "草泥马",
        "傻逼",
        "煞笔",
        "他妈的",
        "妈的",
        "狗日的",
        "淫秽",
        "色情",
        "约炮",
        "毒品",
        "赌博"
    ];

    private static readonly char[] Separators = ['\r', '\n', ',', '，', ';', '；', '|'];

    public async Task<SensitiveWordValidationResult> ValidateAsync(
        IEnumerable<SensitiveWordInput> inputs,
        CancellationToken cancellationToken = default)
    {
        var configuration = await GetConfigurationAsync(cancellationToken);
        var sensitiveWords = configuration.SensitiveWords;
        if (sensitiveWords.Count == 0)
        {
            return new SensitiveWordValidationResult();
        }

        var violations = new List<string>();
        foreach (var input in inputs)
        {
            var value = input.Value?.Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            foreach (var word in sensitiveWords)
            {
                if (value.Contains(word, StringComparison.OrdinalIgnoreCase))
                {
                    violations.Add($"{input.FieldName} 命中“{word}”");
                }
            }
        }

        return new SensitiveWordValidationResult
        {
            IsValid = violations.Count == 0,
            Violations = violations.Distinct(StringComparer.OrdinalIgnoreCase).ToList()
        };
    }

    public async Task<SensitiveWordsConfiguration> GetConfigurationAsync(CancellationToken cancellationToken = default)
    {
        var setting = await db.SystemSettings
            .AsNoTracking()
            .Include(item => item.UpdatedByUser)
            .FirstOrDefaultAsync(item => item.SettingKey == SystemSettingKeys.SensitiveWords, cancellationToken);

        var sensitiveWordsText = string.IsNullOrWhiteSpace(setting?.SettingValue)
            ? string.Join(Environment.NewLine, DefaultSensitiveWords)
            : setting!.SettingValue;
        var sensitiveWords = NormalizeSensitiveWords(sensitiveWordsText);

        return new SensitiveWordsConfiguration
        {
            SensitiveWordsText = string.Join(Environment.NewLine, sensitiveWords),
            SensitiveWords = sensitiveWords,
            SensitiveWordCount = sensitiveWords.Count,
            UpdatedAt = setting?.UpdatedAt,
            UpdatedByUsername = setting?.UpdatedByUser?.Username
        };
    }

    public async Task<SensitiveWordsConfiguration> UpdateConfigurationAsync(
        string rawText,
        int updatedByUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedWords = NormalizeSensitiveWords(rawText);
        var normalizedText = string.Join(Environment.NewLine, normalizedWords);
        var setting = await db.SystemSettings
            .Include(item => item.UpdatedByUser)
            .FirstOrDefaultAsync(item => item.SettingKey == SystemSettingKeys.SensitiveWords, cancellationToken);

        if (setting == null)
        {
            setting = new SystemSetting
            {
                SettingKey = SystemSettingKeys.SensitiveWords,
                SettingValue = normalizedText,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByUserId = updatedByUserId
            };

            db.SystemSettings.Add(setting);
        }
        else
        {
            setting.SettingValue = normalizedText;
            setting.UpdatedAt = DateTime.UtcNow;
            setting.UpdatedByUserId = updatedByUserId;
        }

        await db.SaveChangesAsync(cancellationToken);

        var username = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == updatedByUserId)
            .Select(user => user.Username)
            .FirstOrDefaultAsync(cancellationToken);

        return new SensitiveWordsConfiguration
        {
            SensitiveWordsText = normalizedText,
            SensitiveWords = normalizedWords,
            SensitiveWordCount = normalizedWords.Count,
            UpdatedAt = setting.UpdatedAt,
            UpdatedByUsername = username
        };
    }

    public static List<string> NormalizeSensitiveWords(string? rawText)
    {
        var source = string.IsNullOrWhiteSpace(rawText)
            ? DefaultSensitiveWords
            : rawText.Split(Separators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return source
            .Select(item => item.Trim())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
