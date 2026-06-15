using System.Text;
using System.Text.Json;
using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Services;

public interface IAdminService
{
    Task<AdminSummaryResponse> GetSummaryAsync(CancellationToken cancellationToken = default);
    Task<List<AdminUserListItemResponse>> GetUsersAsync(CancellationToken cancellationToken = default);
    Task<AdminUserListItemResponse?> UpdateUserStatusAsync(
        int userId,
        bool isActive,
        int currentAdminUserId,
        CancellationToken cancellationToken = default);
    Task<AdminUserListItemResponse?> UpdateUserRoleAsync(
        int userId,
        string role,
        int currentAdminUserId,
        CancellationToken cancellationToken = default);
    Task<AdminBatchOperationResultResponse> BatchUpdateUserStatusAsync(
        IReadOnlyCollection<int> userIds,
        bool isActive,
        int currentAdminUserId,
        CancellationToken cancellationToken = default);
    Task<AdminBatchOperationResultResponse> BatchUpdateUserRoleAsync(
        IReadOnlyCollection<int> userIds,
        string role,
        int currentAdminUserId,
        CancellationToken cancellationToken = default);
    Task<bool> ResetUserPasswordAsync(
        int userId,
        string newPassword,
        CancellationToken cancellationToken = default);
    Task<AdminBatchOperationResultResponse> BatchResetUserPasswordAsync(
        IReadOnlyCollection<int> userIds,
        string newPassword,
        CancellationToken cancellationToken = default);
    Task<DatabaseExportResult> ExportDatabaseSnapshotAsync(CancellationToken cancellationToken = default);
}

public class DatabaseExportResult
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/json";
    public string TempFilePath { get; set; } = string.Empty;
    public byte[] Bytes { get; set; } = [];
}

public class AdminService : IAdminService
{
    private readonly AppDbContext _db;

    public AdminService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AdminSummaryResponse> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        return new AdminSummaryResponse
        {
            TotalUsers = await _db.Users.CountAsync(cancellationToken),
            ActiveUsers = await _db.Users.CountAsync(user => user.IsActive, cancellationToken),
            AdminUsers = await _db.Users.CountAsync(
                user => user.IsActive && user.Role == "Admin",
                cancellationToken),
            TotalAccounts = await _db.AccountDailies.CountAsync(cancellationToken),
            TotalBankFlows = await _db.BankFlows.CountAsync(cancellationToken),
            TotalTrades = await _db.StockTrades.CountAsync(cancellationToken),
            TotalAudits = await _db.PortfolioImportAudits.CountAsync(cancellationToken),
            LastUserLoginAt = await _db.Users
                .Where(user => user.LastLoginAt != null)
                .OrderByDescending(user => user.LastLoginAt)
                .Select(user => user.LastLoginAt)
                .FirstOrDefaultAsync(cancellationToken),
            LastAuditCreatedAt = await _db.PortfolioImportAudits
                .OrderByDescending(audit => audit.CreatedAt)
                .Select(audit => (DateTime?)audit.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken)
        };
    }

    public async Task<List<AdminUserListItemResponse>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        var users = await _db.Users
            .AsNoTracking()
            .OrderByDescending(user => user.CreatedAt)
            .ToListAsync(cancellationToken);

        var performanceLookup = await BuildUserPerformanceLookupAsync(users, cancellationToken);
        return users
            .Select(user => MapUser(
                user,
                performanceLookup.GetValueOrDefault(user.Id) ?? new AdminUserPerformanceResponse()))
            .ToList();
    }

    public async Task<AdminUserListItemResponse?> UpdateUserStatusAsync(
        int userId,
        bool isActive,
        int currentAdminUserId,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user == null)
        {
            return null;
        }

        if (!isActive && string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            var activeAdminCount = await _db.Users.CountAsync(
                item => item.IsActive && item.Role == "Admin",
                cancellationToken);

            if (activeAdminCount <= 1)
            {
                throw new InvalidOperationException("系统至少需要保留一个启用中的管理员账户。");
            }
        }

        if (!isActive && user.Id == currentAdminUserId)
        {
            throw new InvalidOperationException("不能在当前会话里禁用自己的管理员账户。");
        }

        user.IsActive = isActive;
        await _db.SaveChangesAsync(cancellationToken);
        return MapUser(user);
    }

    public async Task<AdminUserListItemResponse?> UpdateUserRoleAsync(
        int userId,
        string role,
        int currentAdminUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedRole = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
            ? "Admin"
            : "User";

        var user = await _db.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user == null)
        {
            return null;
        }

        if (!string.Equals(normalizedRole, "Admin", StringComparison.OrdinalIgnoreCase)
            && string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            var activeAdminCount = await _db.Users.CountAsync(
                item => item.IsActive && item.Role == "Admin",
                cancellationToken);

            if (activeAdminCount <= 1)
            {
                throw new InvalidOperationException("系统至少需要保留一个启用中的管理员账户。");
            }
        }

        if (!string.Equals(normalizedRole, "Admin", StringComparison.OrdinalIgnoreCase)
            && user.Id == currentAdminUserId)
        {
            throw new InvalidOperationException("不能在当前会话里取消自己的管理员权限。");
        }

        user.Role = normalizedRole;
        await _db.SaveChangesAsync(cancellationToken);
        return MapUser(user);
    }

    public async Task<AdminBatchOperationResultResponse> BatchUpdateUserStatusAsync(
        IReadOnlyCollection<int> userIds,
        bool isActive,
        int currentAdminUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedIds = NormalizeUserIds(userIds);
        if (normalizedIds.Count == 0)
        {
            throw new InvalidOperationException("请至少选择一个用户。");
        }

        var users = await _db.Users
            .Where(item => normalizedIds.Contains(item.Id))
            .ToListAsync(cancellationToken);

        if (users.Count == 0)
        {
            throw new InvalidOperationException("未找到选中的用户。");
        }

        if (!isActive && users.Any(user => user.Id == currentAdminUserId))
        {
            throw new InvalidOperationException("不能在当前会话里批量禁用自己的管理员账户。");
        }

        if (!isActive)
        {
            await EnsureAtLeastOneActiveAdminAsync(
                normalizedIds,
                item => (false, NormalizeRole(item.Role)),
                cancellationToken);
        }

        foreach (var user in users)
        {
            user.IsActive = isActive;
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new AdminBatchOperationResultResponse
        {
            UpdatedCount = users.Count,
            UserIds = users.Select(user => user.Id).OrderBy(id => id).ToList()
        };
    }

    public async Task<AdminBatchOperationResultResponse> BatchUpdateUserRoleAsync(
        IReadOnlyCollection<int> userIds,
        string role,
        int currentAdminUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedIds = NormalizeUserIds(userIds);
        if (normalizedIds.Count == 0)
        {
            throw new InvalidOperationException("请至少选择一个用户。");
        }

        var normalizedRole = NormalizeRole(role);
        var users = await _db.Users
            .Where(item => normalizedIds.Contains(item.Id))
            .ToListAsync(cancellationToken);

        if (users.Count == 0)
        {
            throw new InvalidOperationException("未找到选中的用户。");
        }

        if (!IsAdminRole(normalizedRole) && users.Any(user => user.Id == currentAdminUserId))
        {
            throw new InvalidOperationException("不能在当前会话里批量取消自己的管理员权限。");
        }

        if (!IsAdminRole(normalizedRole))
        {
            await EnsureAtLeastOneActiveAdminAsync(
                normalizedIds,
                item => (item.IsActive, normalizedRole),
                cancellationToken);
        }

        foreach (var user in users)
        {
            user.Role = normalizedRole;
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new AdminBatchOperationResultResponse
        {
            UpdatedCount = users.Count,
            UserIds = users.Select(user => user.Id).OrderBy(id => id).ToList()
        };
    }

    public async Task<bool> ResetUserPasswordAsync(
        int userId,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user == null)
        {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await RevokeQuickLoginTokensAsync(userId, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<AdminBatchOperationResultResponse> BatchResetUserPasswordAsync(
        IReadOnlyCollection<int> userIds,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        var normalizedIds = NormalizeUserIds(userIds);
        if (normalizedIds.Count == 0)
        {
            throw new InvalidOperationException("请至少选择一个用户。");
        }

        var users = await _db.Users
            .Where(item => normalizedIds.Contains(item.Id))
            .ToListAsync(cancellationToken);

        if (users.Count == 0)
        {
            throw new InvalidOperationException("未找到选中的用户。");
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        foreach (var user in users)
        {
            user.PasswordHash = passwordHash;
        }

        await RevokeQuickLoginTokensAsync(normalizedIds, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return new AdminBatchOperationResultResponse
        {
            UpdatedCount = users.Count,
            UserIds = users.Select(user => user.Id).OrderBy(id => id).ToList()
        };
    }

    private async Task RevokeQuickLoginTokensAsync(int userId, CancellationToken cancellationToken)
    {
        await RevokeQuickLoginTokensAsync([userId], cancellationToken);
    }

    private async Task RevokeQuickLoginTokensAsync(IReadOnlyCollection<int> userIds, CancellationToken cancellationToken)
    {
        var normalizedIds = NormalizeUserIds(userIds);
        if (normalizedIds.Count == 0)
        {
            return;
        }

        var quickLoginTokens = await _db.QuickLoginTokens
            .Where(item => normalizedIds.Contains(item.UserId))
            .ToListAsync(cancellationToken);

        if (quickLoginTokens.Count == 0)
        {
            return;
        }

        _db.QuickLoginTokens.RemoveRange(quickLoginTokens);
    }

    public async Task<DatabaseExportResult> ExportDatabaseSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var snapshot = new
        {
            exportedAt = DateTime.UtcNow,
            databaseType = "PostgreSQL",
            tables = new
            {
                users = await _db.Users.AsNoTracking().OrderBy(user => user.Id).ToListAsync(cancellationToken),
                accountDailies = await _db.AccountDailies.AsNoTracking().OrderBy(item => item.Date).ToListAsync(cancellationToken),
                bankFlows = await _db.BankFlows.AsNoTracking().OrderBy(item => item.Date).ThenBy(item => item.Id).ToListAsync(cancellationToken),
                stockTrades = await _db.StockTrades.AsNoTracking().OrderBy(item => item.TradeDate).ThenBy(item => item.Id).ToListAsync(cancellationToken),
                tradeNotes = await _db.TradeNotes.AsNoTracking().OrderBy(item => item.Date).ThenBy(item => item.Id).ToListAsync(cancellationToken),
                userContacts = await _db.UserContacts.AsNoTracking().OrderBy(item => item.OwnerUserId).ThenBy(item => item.ContactUserId).ToListAsync(cancellationToken),
                messageConversations = await _db.MessageConversations.AsNoTracking().OrderBy(item => item.Id).ToListAsync(cancellationToken),
                messageConversationParticipants = await _db.MessageConversationParticipants.AsNoTracking().OrderBy(item => item.ConversationId).ThenBy(item => item.UserId).ToListAsync(cancellationToken),
                userMessages = await _db.UserMessages.AsNoTracking().OrderBy(item => item.ConversationId).ThenBy(item => item.Id).ToListAsync(cancellationToken),
                portfolioImportAudits = await _db.PortfolioImportAudits.AsNoTracking().OrderBy(item => item.CreatedAt).ToListAsync(cancellationToken),
                stockBasics = await _db.StockBasics.AsNoTracking().OrderBy(item => item.StockCode).ToListAsync(cancellationToken),
                systemSettings = await _db.SystemSettings.AsNoTracking().OrderBy(item => item.SettingKey).ToListAsync(cancellationToken)
            }
        };

        var json = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        var fileName = $"lies-db-export-{DateTime.Now:yyyyMMdd-HHmmss}.json";
        var tempFilePath = Path.Combine(Path.GetTempPath(), fileName);
        var bytes = Encoding.UTF8.GetBytes(json);
        await File.WriteAllBytesAsync(tempFilePath, bytes, cancellationToken);

        return new DatabaseExportResult
        {
            FileName = fileName,
            TempFilePath = tempFilePath,
            Bytes = bytes
        };
    }

    private async Task<Dictionary<int, AdminUserPerformanceResponse>> BuildUserPerformanceLookupAsync(
        IReadOnlyCollection<User> users,
        CancellationToken cancellationToken)
    {
        var lookup = users.ToDictionary(
            user => user.Id,
            _ => new AdminUserPerformanceResponse());

        if (users.Count == 0)
        {
            return lookup;
        }

        // 兼容旧的单用户历史数据：当历史记录还没有挂接 UserId 时，
        // 优先归到最早创建的非管理员用户名下，而不是后来补建的管理员账户。
        var legacyOwnerUserId = ResolveLegacyOwnerUserId(users);
        var userIds = users.Select(user => user.Id).ToHashSet();

        var accountRecords = await _db.AccountDailies
            .AsNoTracking()
            .Select(item => new AdminAccountRecord
            {
                UserId = item.UserId ?? legacyOwnerUserId,
                Date = item.Date.Date,
                TotalAssets = item.TotalAssets,
                DailyPnL = item.DailyPnL
            })
            .Where(item => item.UserId.HasValue && userIds.Contains(item.UserId.Value))
            .ToListAsync(cancellationToken);

        var bankFlowRecords = await _db.BankFlows
            .AsNoTracking()
            .Select(item => new AdminBankFlowRecord
            {
                UserId = item.UserId ?? legacyOwnerUserId,
                Date = item.Date.Date,
                FlowType = item.FlowType,
                Amount = item.Amount
            })
            .Where(item => item.UserId.HasValue && userIds.Contains(item.UserId.Value))
            .ToListAsync(cancellationToken);

        var tradeRecords = await _db.StockTrades
            .AsNoTracking()
            .Select(item => new AdminTradeRecord
            {
                UserId = item.UserId ?? legacyOwnerUserId,
                Trade = new StockTrade
                {
                    Id = item.Id,
                    UserId = item.UserId ?? legacyOwnerUserId,
                    TradeDate = item.TradeDate,
                    StockCode = item.StockCode,
                    StockName = item.StockName,
                    Board = item.Board,
                    BuyPrice = item.BuyPrice,
                    BuyQuantity = item.BuyQuantity,
                    SellPrice = item.SellPrice,
                    SellQuantity = item.SellQuantity,
                    PositionPnL = item.PositionPnL,
                    CumulativePnL = item.CumulativePnL,
                    CostPrice = item.CostPrice,
                    CurrentPrice = item.CurrentPrice,
                    PositionQuantity = item.PositionQuantity,
                    DailyPnL = item.DailyPnL,
                    IsLiquidated = item.IsLiquidated,
                    SellReason = item.SellReason,
                    EmotionTags = item.EmotionTags,
                    TradeTags = item.TradeTags,
                    TradeNote = item.TradeNote,
                    TonghuashunLink = item.TonghuashunLink
                }
            })
            .Where(item => item.UserId.HasValue && userIds.Contains(item.UserId.Value))
            .ToListAsync(cancellationToken);

        var accountsByUser = accountRecords
            .Where(item => item.UserId.HasValue)
            .GroupBy(item => item.UserId!.Value)
            .ToDictionary(group => group.Key, group => group.OrderBy(item => item.Date).ToList());
        var flowsByUser = bankFlowRecords
            .Where(item => item.UserId.HasValue)
            .GroupBy(item => item.UserId!.Value)
            .ToDictionary(group => group.Key, group => group.OrderBy(item => item.Date).ToList());
        var tradesByUser = tradeRecords
            .Where(item => item.UserId.HasValue)
            .GroupBy(item => item.UserId!.Value)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.Trade)
                    .OrderBy(item => item.TradeDate)
                    .ThenBy(item => item.Id)
                    .ToList());

        foreach (var user in users)
        {
            accountsByUser.TryGetValue(user.Id, out var userAccounts);
            flowsByUser.TryGetValue(user.Id, out var userFlows);
            tradesByUser.TryGetValue(user.Id, out var userTrades);

            var orderedAccounts = userAccounts ?? [];
            var orderedFlows = userFlows ?? [];
            var orderedTrades = userTrades ?? [];
            var latestAccount = orderedAccounts.LastOrDefault();
            var latestTradeDate = orderedTrades.Count > 0
                ? orderedTrades.Max(item => item.TradeDate.Date)
                : (DateTime?)null;
            var latestFlowDate = orderedFlows.Count > 0
                ? orderedFlows.Max(item => item.Date.Date)
                : (DateTime?)null;

            var correctedSnapshots = TradeMetricsCalculator.Recalculate(orderedTrades);
            var totalTradePnL = correctedSnapshots.Sum(item => item.Trade.DailyPnL);
            var latestTradeDayPnL = latestTradeDate.HasValue
                ? correctedSnapshots
                    .Where(item => item.Trade.TradeDate.Date == latestTradeDate.Value.Date)
                    .Sum(item => item.Trade.DailyPnL)
                : 0m;

            var winTrades = 0;
            var loseTrades = 0;
            var totalTrades = 0;
            var unrealizedPnL = 0m;

            foreach (var group in correctedSnapshots
                         .GroupBy(item => new { item.Trade.StockCode, item.Trade.StockName, item.Trade.Board }))
            {
                var orderedSnapshots = group
                    .OrderBy(item => item.Trade.TradeDate)
                    .ThenBy(item => item.Trade.Id)
                    .ToList();

                var contributions = BuildPnLContributions(orderedSnapshots);
                totalTrades += contributions.Count;
                winTrades += contributions.Count(value => value > 0);
                loseTrades += contributions.Count(value => value < 0);

                var latestSnapshot = orderedSnapshots.LastOrDefault();
                if (latestSnapshot != null && !TradeMetricsCalculator.IsHoldingClosed(latestSnapshot.Trade))
                {
                    unrealizedPnL += latestSnapshot.PositionPnL;
                }
            }

            var latestDataDate = MaxDate(
                latestAccount?.Date,
                latestTradeDate,
                latestFlowDate);
            var latestDailyPnL = latestAccount != null && latestDataDate.HasValue && latestAccount.Date.Date == latestDataDate.Value.Date
                ? latestAccount.DailyPnL
                : latestTradeDate.HasValue && latestDataDate.HasValue && latestTradeDate.Value.Date == latestDataDate.Value.Date
                    ? latestTradeDayPnL
                    : 0m;
            var totalPnL = orderedAccounts.Count > 0
                ? orderedAccounts.Sum(item => item.DailyPnL)
                : totalTradePnL;
            var netBankFlow = orderedFlows.Sum(item => IsInflow(item.FlowType) ? item.Amount : -item.Amount);

            lookup[user.Id] = new AdminUserPerformanceResponse
            {
                LatestDataDate = latestDataDate,
                AccountRecordCount = orderedAccounts.Count,
                BankFlowRecordCount = orderedFlows.Count,
                TradeRecordCount = orderedTrades.Count,
                CurrentTotalAssets = latestAccount?.TotalAssets ?? 0,
                LatestDailyPnL = decimal.Round(latestDailyPnL, 2, MidpointRounding.AwayFromZero),
                TotalPnL = decimal.Round(totalPnL, 2, MidpointRounding.AwayFromZero),
                RealizedPnL = decimal.Round(totalPnL - unrealizedPnL, 2, MidpointRounding.AwayFromZero),
                UnrealizedPnL = decimal.Round(unrealizedPnL, 2, MidpointRounding.AwayFromZero),
                NetBankFlow = decimal.Round(netBankFlow, 2, MidpointRounding.AwayFromZero),
                WinTrades = winTrades,
                LoseTrades = loseTrades,
                TotalTrades = totalTrades,
                WinRate = (winTrades + loseTrades) > 0
                    ? decimal.Round((decimal)winTrades / (winTrades + loseTrades), 4, MidpointRounding.AwayFromZero)
                    : 0
            };
        }

        return lookup;
    }

    private async Task EnsureAtLeastOneActiveAdminAsync(
        IReadOnlyCollection<int> targetUserIds,
        Func<User, (bool IsActive, string Role)> overrideStateFactory,
        CancellationToken cancellationToken)
    {
        var targets = targetUserIds.ToHashSet();
        var users = await _db.Users.ToListAsync(cancellationToken);

        var activeAdminCount = users.Count(user =>
        {
            var nextState = targets.Contains(user.Id)
                ? overrideStateFactory(user)
                : (IsActive: user.IsActive, Role: NormalizeRole(user.Role));

            return nextState.IsActive && IsAdminRole(nextState.Role);
        });

        if (activeAdminCount <= 0)
        {
            throw new InvalidOperationException("系统至少需要保留一个启用中的管理员账户。");
        }
    }

    private static List<decimal> BuildPnLContributions(IReadOnlyList<TradeMetricSnapshot> orderedSnapshots)
    {
        var contributions = new List<decimal>();
        var segmentPnL = 0m;
        var hasRecord = false;

        foreach (var snapshot in orderedSnapshots)
        {
            segmentPnL += snapshot.Trade.DailyPnL;
            hasRecord = true;

            if (!TradeMetricsCalculator.IsHoldingClosed(snapshot.Trade))
            {
                continue;
            }

            contributions.Add(segmentPnL);
            segmentPnL = 0;
            hasRecord = false;
        }

        if (hasRecord)
        {
            contributions.Add(segmentPnL);
        }

        return contributions;
    }

    private static int? ResolveLegacyOwnerUserId(IEnumerable<User> users)
    {
        var orderedUsers = users
            .OrderBy(user => user.CreatedAt)
            .ToList();

        if (orderedUsers.Count == 1)
        {
            return orderedUsers[0].Id;
        }

        var earliestNonAdminUser = orderedUsers
            .FirstOrDefault(user => !IsAdminRole(user.Role));
        if (earliestNonAdminUser != null)
        {
            return earliestNonAdminUser.Id;
        }

        return orderedUsers
            .FirstOrDefault(user => user.IsActive)
            ?.Id
            ?? orderedUsers.FirstOrDefault()?.Id;
    }

    private static DateTime? MaxDate(params DateTime?[] values)
    {
        var validValues = values
            .Where(value => value.HasValue)
            .Select(value => value!.Value.Date)
            .OrderByDescending(value => value)
            .ToList();

        return validValues.Count > 0 ? validValues[0] : null;
    }

    private static HashSet<int> NormalizeUserIds(IEnumerable<int> userIds)
    {
        return userIds
            .Where(id => id > 0)
            .ToHashSet();
    }

    private static string NormalizeRole(string? role)
    {
        return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ? "Admin" : "User";
    }

    private static bool IsAdminRole(string? role)
    {
        return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsInflow(string? flowType)
    {
        return string.Equals(flowType, "转入", StringComparison.Ordinal);
    }

    private static AdminUserListItemResponse MapUser(
        User user,
        AdminUserPerformanceResponse? performance = null)
    {
        var role = NormalizeRole(user.Role);

        return new AdminUserListItemResponse
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Role = role,
            IsAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase),
            IsActive = user.IsActive,
            AvatarUrl = NormalizeAssetUrl(user.AvatarPath),
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt,
            Performance = performance ?? new AdminUserPerformanceResponse()
        };
    }

    private static string? NormalizeAssetUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.StartsWith('/') ? value : $"/{value}";
    }

    private sealed class AdminAccountRecord
    {
        public int? UserId { get; set; }
        public DateTime Date { get; set; }
        public decimal TotalAssets { get; set; }
        public decimal DailyPnL { get; set; }
    }

    private sealed class AdminBankFlowRecord
    {
        public int? UserId { get; set; }
        public DateTime Date { get; set; }
        public string FlowType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    private sealed class AdminTradeRecord
    {
        public int? UserId { get; set; }
        public StockTrade Trade { get; set; } = new();
    }
}
