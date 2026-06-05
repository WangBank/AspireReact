using Lies.Server.Entities;
using Lies.Server.Services;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Data;

public static class DatabaseInitializer
{
    private const string DefaultAdminUsername = "bank";
    private const string DefaultAdminEmail = "bank@admin.local";
    private const string DefaultAdminPassword = "Wq-.1997315421";

    public static async Task InitializeAsync(AppDbContext context)
    {
        // 数据库由 MigrationService 通过 MigrateAsync() 自动创建和迁移，此处仅做种子数据填充

        // 添加一些初始数据（可选）
        if (!await context.StockBasics.AnyAsync())
        {
            var initialStocks = new List<StockBasic>
            {
                new StockBasic { StockCode = "000001", StockName = "平安银行", StockAbbr = "PAYH", Board = "主板" },
                new StockBasic { StockCode = "000002", StockName = "万科A", StockAbbr = "WKA", Board = "主板" },
                new StockBasic { StockCode = "300750", StockName = "宁德时代", StockAbbr = "NDSD", Board = "创业板" },
                new StockBasic { StockCode = "688981", StockName = "中芯国际", StockAbbr = "ZXGJ", Board = "科创板" },
                new StockBasic { StockCode = "830946", StockName = "森萱医药", StockAbbr = "SXYY", Board = "北交所" }
            };

            await context.StockBasics.AddRangeAsync(initialStocks);
            await context.SaveChangesAsync();
        }

        await EnsureAdminUserAsync(context);
        await BackfillLegacyBusinessDataOwnersAsync(context);
        await EnsureReflectionSeedAsync(context);
        await EnsureSensitiveWordsSeedAsync(context);
    }

    private static async Task EnsureAdminUserAsync(AppDbContext context)
    {
        var adminUser = await context.Users.FirstOrDefaultAsync(user => user.Username == DefaultAdminUsername);
        if (adminUser == null)
        {
            adminUser = new User
            {
                Username = DefaultAdminUsername,
                Email = DefaultAdminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(DefaultAdminPassword),
                Role = "Admin",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            context.Users.Add(adminUser);
            await context.SaveChangesAsync();
            return;
        }

        var changed = false;

        if (!string.Equals(adminUser.Email, DefaultAdminEmail, StringComparison.OrdinalIgnoreCase))
        {
            adminUser.Email = DefaultAdminEmail;
            changed = true;
        }

        if (!string.Equals(adminUser.Role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            adminUser.Role = "Admin";
            changed = true;
        }

        if (!adminUser.IsActive)
        {
            adminUser.IsActive = true;
            changed = true;
        }

        if (!BCrypt.Net.BCrypt.Verify(DefaultAdminPassword, adminUser.PasswordHash))
        {
            adminUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(DefaultAdminPassword);
            changed = true;
        }

        if (changed)
        {
            await context.SaveChangesAsync();
        }
    }

    private static async Task EnsureReflectionSeedAsync(AppDbContext context)
    {
        var exists = await context.SystemSettings.AnyAsync(item => item.SettingKey == SystemSettingKeys.ReflectionSource);
        if (exists)
        {
            return;
        }

        var seedFilePath = Path.Combine(AppContext.BaseDirectory, "SeedData", "reflection-source.txt");
        var content = File.Exists(seedFilePath)
            ? await File.ReadAllTextAsync(seedFilePath)
            : string.Empty;

        context.SystemSettings.Add(new SystemSetting
        {
            SettingKey = SystemSettingKeys.ReflectionSource,
            SettingValue = content.Replace("\r\n", "\n").Trim(),
            UpdatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    private static async Task EnsureSensitiveWordsSeedAsync(AppDbContext context)
    {
        var exists = await context.SystemSettings.AnyAsync(item => item.SettingKey == SystemSettingKeys.SensitiveWords);
        if (exists)
        {
            return;
        }

        context.SystemSettings.Add(new SystemSetting
        {
            SettingKey = SystemSettingKeys.SensitiveWords,
            SettingValue = string.Join(Environment.NewLine, SensitiveWordService.NormalizeSensitiveWords(null)),
            UpdatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    private static async Task BackfillLegacyBusinessDataOwnersAsync(AppDbContext context)
    {
        var legacyOwnerId = await ResolveLegacyOwnerUserIdAsync(context);
        if (!legacyOwnerId.HasValue)
        {
            return;
        }

        var changed = false;

        changed |= await context.AccountDailies
            .Where(item => item.UserId == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.UserId, legacyOwnerId.Value)) > 0;

        changed |= await context.BankFlows
            .Where(item => item.UserId == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.UserId, legacyOwnerId.Value)) > 0;

        changed |= await context.StockTrades
            .Where(item => item.UserId == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.UserId, legacyOwnerId.Value)) > 0;

        changed |= await context.TradeNotes
            .Where(item => item.UserId == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.UserId, legacyOwnerId.Value)) > 0;

        changed |= await context.PortfolioImportAudits
            .Where(item => item.UserId == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.UserId, legacyOwnerId.Value)) > 0;

        if (changed)
        {
            await context.SaveChangesAsync();
        }
    }

    private static async Task<int?> ResolveLegacyOwnerUserIdAsync(AppDbContext context)
    {
        var orderedUsers = await context.Users
            .AsNoTracking()
            .OrderBy(user => user.CreatedAt)
            .ThenBy(user => user.Id)
            .ToListAsync();

        if (orderedUsers.Count == 0)
        {
            return null;
        }

        if (orderedUsers.Count == 1)
        {
            return orderedUsers[0].Id;
        }

        var earliestNonAdminUser = orderedUsers
            .FirstOrDefault(user => !string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase));
        if (earliestNonAdminUser != null)
        {
            return earliestNonAdminUser.Id;
        }

        return orderedUsers
            .FirstOrDefault(user => user.IsActive)
            ?.Id
            ?? orderedUsers[0].Id;
    }
}
