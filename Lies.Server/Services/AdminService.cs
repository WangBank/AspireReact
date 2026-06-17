using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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
    Task<DatabaseExportResult> ExportDatabaseBackupAsync(CancellationToken cancellationToken = default);
    Task<AdminDatabaseRestoreResponse> RestoreDatabaseBackupAsync(
        IFormFile file,
        bool confirmRestore,
        CancellationToken cancellationToken = default);
}

public class DatabaseExportResult
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public string TempFilePath { get; set; } = string.Empty;
}

public class AdminService : IAdminService
{
    private static readonly SemaphoreSlim DatabaseMaintenanceLock = new(1, 1);
    private static readonly HashSet<string> SupportedRestoreExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".sql",
        ".dump",
        ".backup",
        ".tar"
    };

    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminService> _logger;

    public AdminService(AppDbContext db, IConfiguration configuration, ILogger<AdminService> logger)
    {
        _db = db;
        _configuration = configuration;
        _logger = logger;
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

        EnsureUserIsNotAdminTarget(user);

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

        EnsureUserIsNotAdminTarget(user);

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

        EnsureUsersDoNotContainAdminTargets(users);

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

        EnsureUsersDoNotContainAdminTargets(users);

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

        EnsureUserIsNotAdminTarget(user);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await RevokeQuickLoginTokensAsync(userId, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
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

    public async Task<DatabaseExportResult> ExportDatabaseBackupAsync(CancellationToken cancellationToken = default)
    {
        var connectionString = _db.Database.GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("PostgreSQL connection string is not configured.");
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.Host)
            || string.IsNullOrWhiteSpace(builder.Database)
            || string.IsNullOrWhiteSpace(builder.Username))
        {
            throw new InvalidOperationException("PostgreSQL connection string is incomplete.");
        }

        var fileName = $"lies-db-backup-{DateTime.Now:yyyyMMdd-HHmmss}.dump";
        var tempFilePath = Path.Combine(Path.GetTempPath(), fileName);
        var attemptedPgDumpPaths = GetPgDumpCandidates().ToList();

        try
        {
            // 本地开发常见场景是数据库跑在 Docker 容器里，但宿主机没有安装 pg_dump。
            if (!await TryExportDatabaseBackupWithLocalPgDumpAsync(
                    builder,
                    tempFilePath,
                    attemptedPgDumpPaths,
                    cancellationToken))
            {
                var dockerContainer = await TryResolveDockerPostgresContainerAsync(builder, cancellationToken);
                if (dockerContainer == null)
                {
                    throw new InvalidOperationException(
                        $"未找到 pg_dump，可通过配置 DatabaseBackup:PgDumpPath 指定路径。当前尝试路径: {string.Join(", ", attemptedPgDumpPaths)}");
                }

                await ExportDatabaseBackupWithDockerPgDumpAsync(
                    builder,
                    tempFilePath,
                    fileName,
                    dockerContainer,
                    cancellationToken);
            }

            EnsureDumpFileExists(tempFilePath);
        }
        catch
        {
            TryDeleteFile(tempFilePath);
            throw;
        }

        return new DatabaseExportResult
        {
            FileName = fileName,
            ContentType = "application/octet-stream",
            TempFilePath = tempFilePath
        };
    }

    public async Task<AdminDatabaseRestoreResponse> RestoreDatabaseBackupAsync(
        IFormFile file,
        bool confirmRestore,
        CancellationToken cancellationToken = default)
    {
        if (!confirmRestore)
        {
            throw new InvalidOperationException("请先确认当前数据库将被上传的 dump 文件覆盖。");
        }

        if (file == null || file.Length <= 0)
        {
            throw new InvalidOperationException("请上传有效的 dump 备份文件。");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!SupportedRestoreExtensions.Contains(extension))
        {
            throw new InvalidOperationException("仅支持 .sql、.dump、.backup、.tar 格式的 PostgreSQL 备份文件。");
        }

        var connectionString = _db.Database.GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("PostgreSQL connection string is not configured.");
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.Host)
            || string.IsNullOrWhiteSpace(builder.Database)
            || string.IsNullOrWhiteSpace(builder.Username))
        {
            throw new InvalidOperationException("PostgreSQL connection string is incomplete.");
        }

        EnsureRestorableDatabaseName(builder.Database);

        var originalFileName = Path.GetFileName(file.FileName);
        var tempFilePath = Path.Combine(
            Path.GetTempPath(),
            $"lies-db-restore-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{extension}");

        await using (var fileStream = File.Create(tempFilePath))
        {
            await file.CopyToAsync(fileStream, cancellationToken);
        }

        await DatabaseMaintenanceLock.WaitAsync(cancellationToken);

        try
        {
            try
            {
                await _db.Database.CloseConnectionAsync();
            }
            catch
            {
                // Best effort only. The restore flow forcibly disconnects all active sessions afterwards.
            }

            NpgsqlConnection.ClearAllPools();

            await PrepareTargetDatabaseForRestoreAsync(builder, cancellationToken);

            var restoredLocally = IsSqlDumpExtension(extension)
                ? await TryRestoreSqlBackupWithLocalPsqlAsync(builder, tempFilePath, cancellationToken)
                : await TryRestoreArchiveBackupWithLocalPgRestoreAsync(builder, tempFilePath, cancellationToken);

            if (!restoredLocally)
            {
                var dockerContainer = await TryResolveDockerPostgresContainerAsync(builder, cancellationToken);
                if (dockerContainer == null)
                {
                    throw new InvalidOperationException(
                        IsSqlDumpExtension(extension)
                            ? "未找到可用的 psql 来恢复 SQL 备份；如果当前数据库运行在 Docker 中，请确认宿主机可用 docker CLI。"
                            : "未找到可用的 pg_restore 来恢复 dump 备份；如果当前数据库运行在 Docker 中，请确认宿主机可用 docker CLI。");
                }

                await RestoreDatabaseBackupWithDockerToolsAsync(
                    builder,
                    tempFilePath,
                    extension,
                    dockerContainer,
                    cancellationToken);
            }
        }
        finally
        {
            DatabaseMaintenanceLock.Release();
            NpgsqlConnection.ClearAllPools();
            TryDeleteFile(tempFilePath);
        }

        return new AdminDatabaseRestoreResponse
        {
            FileName = originalFileName,
            Database = builder.Database,
            FileSizeBytes = file.Length,
            RestoredAt = DateTime.Now
        };
    }

    private async Task PrepareTargetDatabaseForRestoreAsync(
        NpgsqlConnectionStringBuilder builder,
        CancellationToken cancellationToken)
    {
        EnsureRestorableDatabaseName(builder.Database);
        var targetDatabase = builder.Database!;

        var adminBuilder = new NpgsqlConnectionStringBuilder(builder.ConnectionString)
        {
            Database = "postgres",
            Pooling = false
        };

        var quotedDatabaseName = QuotePostgresIdentifier(targetDatabase);

        await using var connection = new NpgsqlConnection(adminBuilder.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var disconnectCommand = new NpgsqlCommand(
                """
                UPDATE pg_database
                SET datallowconn = false
                WHERE datname = @database;

                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = @database
                  AND pid <> pg_backend_pid();
                """,
                connection);
            disconnectCommand.Parameters.AddWithValue("database", targetDatabase);
            await disconnectCommand.ExecuteNonQueryAsync(cancellationToken);

            await using var dropCommand = new NpgsqlCommand(
                $"DROP DATABASE IF EXISTS {quotedDatabaseName};",
                connection);
            await dropCommand.ExecuteNonQueryAsync(cancellationToken);

            await using var createCommand = new NpgsqlCommand(
                $"CREATE DATABASE {quotedDatabaseName};",
                connection);
            await createCommand.ExecuteNonQueryAsync(cancellationToken);
        }
        catch
        {
            try
            {
                await using var reconnectCommand = new NpgsqlCommand(
                    """
                    UPDATE pg_database
                    SET datallowconn = true
                    WHERE datname = @database;
                    """,
                    connection);
                reconnectCommand.Parameters.AddWithValue("database", targetDatabase);
                await reconnectCommand.ExecuteNonQueryAsync(cancellationToken);
            }
            catch
            {
                // Best effort only.
            }

            throw;
        }
    }

    private async Task<bool> TryRestoreSqlBackupWithLocalPsqlAsync(
        NpgsqlConnectionStringBuilder builder,
        string inputPath,
        CancellationToken cancellationToken)
    {
        Exception? lastStartException = null;
        var attemptedPsqlPaths = GetPsqlCandidates().ToList();

        foreach (var psqlPath in attemptedPsqlPaths)
        {
            try
            {
                await RestoreSqlBackupWithLocalPsqlAsync(builder, inputPath, psqlPath, cancellationToken);
                _logger.LogInformation("Database SQL dump restored via local psql: {PsqlPath}", psqlPath);
                return true;
            }
            catch (Win32Exception ex)
            {
                lastStartException = ex;
                _logger.LogDebug(ex, "psql path is not available: {PsqlPath}", psqlPath);
            }
        }

        if (lastStartException != null)
        {
            _logger.LogWarning(
                lastStartException,
                "Local psql is unavailable. Tried paths: {PsqlPaths}",
                string.Join(", ", attemptedPsqlPaths));
        }

        return false;
    }

    private async Task<bool> TryRestoreArchiveBackupWithLocalPgRestoreAsync(
        NpgsqlConnectionStringBuilder builder,
        string inputPath,
        CancellationToken cancellationToken)
    {
        Exception? lastStartException = null;
        var attemptedPgRestorePaths = GetPgRestoreCandidates().ToList();

        foreach (var pgRestorePath in attemptedPgRestorePaths)
        {
            try
            {
                await RestoreArchiveBackupWithLocalPgRestoreAsync(builder, inputPath, pgRestorePath, cancellationToken);
                _logger.LogInformation("Database archive dump restored via local pg_restore: {PgRestorePath}", pgRestorePath);
                return true;
            }
            catch (Win32Exception ex)
            {
                lastStartException = ex;
                _logger.LogDebug(ex, "pg_restore path is not available: {PgRestorePath}", pgRestorePath);
            }
        }

        if (lastStartException != null)
        {
            _logger.LogWarning(
                lastStartException,
                "Local pg_restore is unavailable. Tried paths: {PgRestorePaths}",
                string.Join(", ", attemptedPgRestorePaths));
        }

        return false;
    }

    private async Task RestoreSqlBackupWithLocalPsqlAsync(
        NpgsqlConnectionStringBuilder builder,
        string inputPath,
        string psqlPath,
        CancellationToken cancellationToken)
    {
        var startInfo = CreateProcessStartInfo(psqlPath);

        foreach (var argument in BuildPsqlRestoreArguments(builder, inputPath))
        {
            startInfo.ArgumentList.Add(argument);
        }

        ApplyPgEnvironment(startInfo, builder);

        var result = await RunProcessAsync(startInfo, cancellationToken);
        EnsureProcessSucceeded("psql restore", result, "恢复 PostgreSQL SQL 备份失败");
    }

    private async Task RestoreArchiveBackupWithLocalPgRestoreAsync(
        NpgsqlConnectionStringBuilder builder,
        string inputPath,
        string pgRestorePath,
        CancellationToken cancellationToken)
    {
        var startInfo = CreateProcessStartInfo(pgRestorePath);

        foreach (var argument in BuildPgRestoreArguments(builder, inputPath))
        {
            startInfo.ArgumentList.Add(argument);
        }

        ApplyPgEnvironment(startInfo, builder);

        var result = await RunProcessAsync(startInfo, cancellationToken);
        EnsureProcessSucceeded("pg_restore", result, "恢复 PostgreSQL dump 备份失败");
    }

    private async Task RestoreDatabaseBackupWithDockerToolsAsync(
        NpgsqlConnectionStringBuilder builder,
        string inputPath,
        string extension,
        DockerContainerMatch dockerContainer,
        CancellationToken cancellationToken)
    {
        var containerDumpPath = $"/tmp/lies-db-restore-{Guid.NewGuid():N}{extension}";

        try
        {
            var copyStartInfo = CreateProcessStartInfo("docker");
            copyStartInfo.ArgumentList.Add("cp");
            copyStartInfo.ArgumentList.Add(inputPath);
            copyStartInfo.ArgumentList.Add($"{dockerContainer.ContainerId}:{containerDumpPath}");

            var copyResult = await RunProcessAsync(copyStartInfo, cancellationToken);
            EnsureProcessSucceeded("docker cp", copyResult, "复制数据库备份到 Docker 容器失败");

            var restoreStartInfo = CreateProcessStartInfo("docker");
            restoreStartInfo.ArgumentList.Add("exec");
            ApplyDockerPgEnvironment(restoreStartInfo, builder);
            restoreStartInfo.ArgumentList.Add(dockerContainer.ContainerId);
            restoreStartInfo.ArgumentList.Add(IsSqlDumpExtension(extension) ? "psql" : "pg_restore");

            var arguments = IsSqlDumpExtension(extension)
                ? BuildPsqlRestoreArguments(builder, containerDumpPath, "127.0.0.1", dockerContainer.ContainerPort)
                : BuildPgRestoreArguments(builder, containerDumpPath, "127.0.0.1", dockerContainer.ContainerPort);

            foreach (var argument in arguments)
            {
                restoreStartInfo.ArgumentList.Add(argument);
            }

            var restoreResult = await RunProcessAsync(restoreStartInfo, cancellationToken);
            EnsureProcessSucceeded(
                IsSqlDumpExtension(extension) ? "docker exec psql" : "docker exec pg_restore",
                restoreResult,
                "通过 Docker 恢复 PostgreSQL 备份失败");

            _logger.LogInformation(
                "Database backup restored via docker container {ContainerName} ({ContainerId})",
                dockerContainer.ContainerName,
                dockerContainer.ContainerId);
        }
        catch (Win32Exception ex)
        {
            _logger.LogWarning(ex, "Docker CLI is not available while restoring PostgreSQL backup.");
            throw new InvalidOperationException("当前环境缺少 docker CLI，无法使用 Docker 容器恢复数据库。");
        }
        finally
        {
            try
            {
                var cleanupStartInfo = CreateProcessStartInfo("docker");
                cleanupStartInfo.ArgumentList.Add("exec");
                cleanupStartInfo.ArgumentList.Add(dockerContainer.ContainerId);
                cleanupStartInfo.ArgumentList.Add("rm");
                cleanupStartInfo.ArgumentList.Add("-f");
                cleanupStartInfo.ArgumentList.Add(containerDumpPath);
                await RunProcessAsync(cleanupStartInfo, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(
                    ex,
                    "Failed to delete temporary restore file from docker container {ContainerId}",
                    dockerContainer.ContainerId);
            }
        }
    }

    private async Task<bool> TryExportDatabaseBackupWithLocalPgDumpAsync(
        NpgsqlConnectionStringBuilder builder,
        string outputPath,
        IReadOnlyList<string> attemptedPgDumpPaths,
        CancellationToken cancellationToken)
    {
        Exception? lastStartException = null;

        foreach (var pgDumpPath in attemptedPgDumpPaths)
        {
            try
            {
                await ExportDatabaseBackupWithLocalPgDumpAsync(builder, outputPath, pgDumpPath, cancellationToken);
                _logger.LogInformation("Database dump exported via local pg_dump: {PgDumpPath}", pgDumpPath);
                return true;
            }
            catch (Win32Exception ex)
            {
                lastStartException = ex;
                _logger.LogDebug(ex, "pg_dump path is not available: {PgDumpPath}", pgDumpPath);
            }
        }

        if (lastStartException != null)
        {
            _logger.LogWarning(
                lastStartException,
                "Local pg_dump is unavailable. Tried paths: {PgDumpPaths}",
                string.Join(", ", attemptedPgDumpPaths));
        }

        return false;
    }

    private async Task ExportDatabaseBackupWithLocalPgDumpAsync(
        NpgsqlConnectionStringBuilder builder,
        string outputPath,
        string pgDumpPath,
        CancellationToken cancellationToken)
    {
        var startInfo = CreateProcessStartInfo(pgDumpPath);

        foreach (var argument in BuildPgDumpArguments(builder, outputPath))
        {
            startInfo.ArgumentList.Add(argument);
        }

        ApplyPgEnvironment(startInfo, builder);

        var result = await RunProcessAsync(startInfo, cancellationToken);
        EnsureProcessSucceeded("pg_dump", result, "导出 PostgreSQL dump 失败");
    }

    private async Task ExportDatabaseBackupWithDockerPgDumpAsync(
        NpgsqlConnectionStringBuilder builder,
        string outputPath,
        string fileName,
        DockerContainerMatch dockerContainer,
        CancellationToken cancellationToken)
    {
        var containerDumpPath = $"/tmp/{fileName}";

        try
        {
            var exportStartInfo = CreateProcessStartInfo("docker");
            exportStartInfo.ArgumentList.Add("exec");
            ApplyDockerPgEnvironment(exportStartInfo, builder);
            exportStartInfo.ArgumentList.Add(dockerContainer.ContainerId);
            exportStartInfo.ArgumentList.Add("pg_dump");

            foreach (var argument in BuildPgDumpArguments(
                         builder,
                         containerDumpPath,
                         hostOverride: "127.0.0.1",
                         portOverride: dockerContainer.ContainerPort))
            {
                exportStartInfo.ArgumentList.Add(argument);
            }

            var exportResult = await RunProcessAsync(exportStartInfo, cancellationToken);
            EnsureProcessSucceeded("docker exec pg_dump", exportResult, "导出 PostgreSQL dump 失败");

            var copyStartInfo = CreateProcessStartInfo("docker");
            copyStartInfo.ArgumentList.Add("cp");
            copyStartInfo.ArgumentList.Add($"{dockerContainer.ContainerId}:{containerDumpPath}");
            copyStartInfo.ArgumentList.Add(outputPath);

            var copyResult = await RunProcessAsync(copyStartInfo, cancellationToken);
            EnsureProcessSucceeded("docker cp", copyResult, "复制数据库备份文件失败");

            _logger.LogInformation(
                "Database dump exported via docker container {ContainerName} ({ContainerId})",
                dockerContainer.ContainerName,
                dockerContainer.ContainerId);
        }
        finally
        {
            try
            {
                var cleanupStartInfo = CreateProcessStartInfo("docker");
                cleanupStartInfo.ArgumentList.Add("exec");
                cleanupStartInfo.ArgumentList.Add(dockerContainer.ContainerId);
                cleanupStartInfo.ArgumentList.Add("rm");
                cleanupStartInfo.ArgumentList.Add("-f");
                cleanupStartInfo.ArgumentList.Add(containerDumpPath);
                await RunProcessAsync(cleanupStartInfo, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(
                    ex,
                    "Failed to delete temporary dump file from docker container {ContainerId}",
                    dockerContainer.ContainerId);
            }
        }
    }

    private static ProcessStartInfo CreateProcessStartInfo(string fileName)
    {
        return new ProcessStartInfo
        {
            FileName = fileName,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
    }

    private async Task<DockerContainerMatch?> TryResolveDockerPostgresContainerAsync(
        NpgsqlConnectionStringBuilder builder,
        CancellationToken cancellationToken)
    {
        if (!IsLocalDockerHost(builder.Host))
        {
            return null;
        }

        ProcessExecutionResult dockerPsResult;
        try
        {
            var dockerPsStartInfo = CreateProcessStartInfo("docker");
            dockerPsStartInfo.ArgumentList.Add("ps");
            dockerPsStartInfo.ArgumentList.Add("--format");
            dockerPsStartInfo.ArgumentList.Add("{{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Ports}}");
            dockerPsResult = await RunProcessAsync(dockerPsStartInfo, cancellationToken);
        }
        catch (Win32Exception ex)
        {
            _logger.LogDebug(ex, "Docker CLI is not available while resolving PostgreSQL container.");
            return null;
        }

        if (dockerPsResult.ExitCode != 0)
        {
            _logger.LogWarning("docker ps failed while resolving PostgreSQL container: {Output}", dockerPsResult.GetErrorMessage());
            return null;
        }

        var candidates = dockerPsResult.StandardOutput
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(ParseDockerContainerMatch)
            .Where(item => item != null && IsLikelyPostgresContainer(item))
            .Cast<DockerContainerMatch>()
            .ToList();

        if (candidates.Count == 0)
        {
            return null;
        }

        var hostPortMatches = candidates
            .Where(item => item.Ports.Contains($":{builder.Port}->", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (hostPortMatches.Count == 1)
        {
            return hostPortMatches[0];
        }

        if (hostPortMatches.Count > 1)
        {
            candidates = hostPortMatches;
        }

        if (candidates.Count == 1)
        {
            return candidates[0];
        }

        var exactNameMatches = candidates
            .Where(item => string.Equals(item.ContainerName, builder.Host, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return exactNameMatches.Count == 1 ? exactNameMatches[0] : null;
    }

    private static DockerContainerMatch? ParseDockerContainerMatch(string line)
    {
        var parts = line.Split('\t', 4, StringSplitOptions.None);
        if (parts.Length < 4)
        {
            return null;
        }

        var ports = parts[3];
        var internalPort = 5432;
        var mapping = ports
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(item => item.Contains("->", StringComparison.Ordinal));

        if (!string.IsNullOrWhiteSpace(mapping))
        {
            var portMapping = mapping.Split("->", 2, StringSplitOptions.TrimEntries);
            if (portMapping.Length == 2)
            {
                var targetPortPart = portMapping[1].Split('/', 2, StringSplitOptions.TrimEntries)[0];
                if (int.TryParse(targetPortPart, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedPort))
                {
                    internalPort = parsedPort;
                }
            }
        }

        return new DockerContainerMatch
        {
            ContainerId = parts[0],
            Image = parts[1],
            ContainerName = parts[2],
            Ports = ports,
            ContainerPort = internalPort
        };
    }

    private static bool IsLikelyPostgresContainer(DockerContainerMatch? item)
    {
        if (item == null)
        {
            return false;
        }

        return item.Image.Contains("postgres", StringComparison.OrdinalIgnoreCase)
            || item.ContainerName.Contains("postgres", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsLocalDockerHost(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            return false;
        }

        return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "host.docker.internal", StringComparison.OrdinalIgnoreCase);
    }

    private IEnumerable<string> GetPgDumpCandidates()
    {
        var configuredPath = _configuration["DatabaseBackup:PgDumpPath"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            yield return configuredPath;
        }

        yield return "pg_dump";

        foreach (var candidate in new[]
                 {
                     "/opt/homebrew/opt/libpq/bin/pg_dump",
                     "/opt/homebrew/bin/pg_dump",
                     "/usr/local/opt/libpq/bin/pg_dump",
                     "/usr/local/bin/pg_dump",
                     "/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump"
                 })
        {
            if (File.Exists(candidate))
            {
                yield return candidate;
            }
        }
    }

    private IEnumerable<string> GetPgRestoreCandidates()
    {
        var configuredPath = _configuration["DatabaseBackup:PgRestorePath"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            yield return configuredPath;
        }

        yield return "pg_restore";

        foreach (var candidate in new[]
                 {
                     "/opt/homebrew/opt/libpq/bin/pg_restore",
                     "/opt/homebrew/bin/pg_restore",
                     "/usr/local/opt/libpq/bin/pg_restore",
                     "/usr/local/bin/pg_restore",
                     "/Applications/Postgres.app/Contents/Versions/latest/bin/pg_restore"
                 })
        {
            if (File.Exists(candidate))
            {
                yield return candidate;
            }
        }
    }

    private IEnumerable<string> GetPsqlCandidates()
    {
        var configuredPath = _configuration["DatabaseBackup:PsqlPath"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            yield return configuredPath;
        }

        yield return "psql";

        foreach (var candidate in new[]
                 {
                     "/opt/homebrew/opt/libpq/bin/psql",
                     "/opt/homebrew/bin/psql",
                     "/usr/local/opt/libpq/bin/psql",
                     "/usr/local/bin/psql",
                     "/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
                 })
        {
            if (File.Exists(candidate))
            {
                yield return candidate;
            }
        }
    }

    private static List<string> BuildPgDumpArguments(
        NpgsqlConnectionStringBuilder builder,
        string outputPath,
        string? hostOverride = null,
        int? portOverride = null)
    {
        return
        [
            "--format=custom",
            "--compress=6",
            "--no-owner",
            "--no-privileges",
            $"--file={outputPath}",
            $"--host={hostOverride ?? builder.Host}",
            $"--port={(portOverride ?? builder.Port).ToString(CultureInfo.InvariantCulture)}",
            $"--username={builder.Username}",
            $"--dbname={builder.Database}"
        ];
    }

    private static List<string> BuildPgRestoreArguments(
        NpgsqlConnectionStringBuilder builder,
        string inputPath,
        string? hostOverride = null,
        int? portOverride = null)
    {
        return
        [
            "--no-owner",
            "--no-privileges",
            $"--host={hostOverride ?? builder.Host}",
            $"--port={(portOverride ?? builder.Port).ToString(CultureInfo.InvariantCulture)}",
            $"--username={builder.Username}",
            $"--dbname={builder.Database}",
            inputPath
        ];
    }

    private static List<string> BuildPsqlRestoreArguments(
        NpgsqlConnectionStringBuilder builder,
        string inputPath,
        string? hostOverride = null,
        int? portOverride = null)
    {
        return
        [
            "--set=ON_ERROR_STOP=1",
            $"--host={hostOverride ?? builder.Host}",
            $"--port={(portOverride ?? builder.Port).ToString(CultureInfo.InvariantCulture)}",
            $"--username={builder.Username}",
            $"--dbname={builder.Database}",
            $"--file={inputPath}"
        ];
    }

    private static void ApplyPgEnvironment(ProcessStartInfo startInfo, NpgsqlConnectionStringBuilder builder)
    {
        if (!string.IsNullOrWhiteSpace(builder.Password))
        {
            startInfo.Environment["PGPASSWORD"] = builder.Password;
        }

        startInfo.Environment["PGSSLMODE"] = MapSslMode(builder);

        if (!string.IsNullOrWhiteSpace(builder.RootCertificate))
        {
            startInfo.Environment["PGSSLROOTCERT"] = builder.RootCertificate;
        }

        if (!string.IsNullOrWhiteSpace(builder.SslCertificate))
        {
            startInfo.Environment["PGSSLCERT"] = builder.SslCertificate;
        }

        if (!string.IsNullOrWhiteSpace(builder.SslKey))
        {
            startInfo.Environment["PGSSLKEY"] = builder.SslKey;
        }
    }

    private static void ApplyDockerPgEnvironment(ProcessStartInfo startInfo, NpgsqlConnectionStringBuilder builder)
    {
        foreach (var pair in BuildPgEnvironment(builder))
        {
            startInfo.ArgumentList.Add("-e");
            startInfo.ArgumentList.Add($"{pair.Key}={pair.Value}");
        }
    }

    private static Dictionary<string, string> BuildPgEnvironment(NpgsqlConnectionStringBuilder builder)
    {
        var environment = new Dictionary<string, string>
        {
            ["PGSSLMODE"] = MapSslMode(builder)
        };

        if (!string.IsNullOrWhiteSpace(builder.Password))
        {
            environment["PGPASSWORD"] = builder.Password;
        }

        if (!string.IsNullOrWhiteSpace(builder.RootCertificate))
        {
            environment["PGSSLROOTCERT"] = builder.RootCertificate;
        }

        if (!string.IsNullOrWhiteSpace(builder.SslCertificate))
        {
            environment["PGSSLCERT"] = builder.SslCertificate;
        }

        if (!string.IsNullOrWhiteSpace(builder.SslKey))
        {
            environment["PGSSLKEY"] = builder.SslKey;
        }

        return environment;
    }

    private static string MapSslMode(NpgsqlConnectionStringBuilder builder)
    {
        return builder.SslMode switch
        {
            SslMode.Disable => "disable",
            SslMode.Allow => "allow",
            SslMode.Prefer => "prefer",
            SslMode.Require => "require",
            SslMode.VerifyCA => "verify-ca",
            SslMode.VerifyFull => "verify-full",
            _ => "prefer"
        };
    }

    private async Task<ProcessExecutionResult> RunProcessAsync(
        ProcessStartInfo startInfo,
        CancellationToken cancellationToken)
    {
        using var process = new Process
        {
            StartInfo = startInfo,
            EnableRaisingEvents = true
        };

        if (!process.Start())
        {
            throw new InvalidOperationException($"Failed to start process: {startInfo.FileName}");
        }

        using var registration = cancellationToken.Register(() =>
        {
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // Ignore kill failures during cancellation.
            }
        });

        var standardOutputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var standardErrorTask = process.StandardError.ReadToEndAsync(cancellationToken);

        await process.WaitForExitAsync(cancellationToken);

        return new ProcessExecutionResult
        {
            ExitCode = process.ExitCode,
            StandardOutput = await standardOutputTask,
            StandardError = await standardErrorTask
        };
    }

    private void EnsureProcessSucceeded(string commandName, ProcessExecutionResult result, string failureMessage)
    {
        if (result.ExitCode == 0)
        {
            return;
        }

        var errorMessage = result.GetErrorMessage();

        _logger.LogError(
            "{CommandName} failed with exit code {ExitCode}. Output: {Output}",
            commandName,
            result.ExitCode,
            errorMessage);

        throw new InvalidOperationException($"{failureMessage}: {errorMessage}");
    }

    private static void EnsureDumpFileExists(string tempFilePath)
    {
        var fileInfo = new FileInfo(tempFilePath);
        if (!fileInfo.Exists || fileInfo.Length <= 0)
        {
            throw new InvalidOperationException("导出的 dump 文件为空。");
        }
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // Best effort cleanup only.
        }
    }

    private static void EnsureRestorableDatabaseName(string? databaseName)
    {
        if (string.IsNullOrWhiteSpace(databaseName))
        {
            throw new InvalidOperationException("未找到当前应用链接的数据库名称。");
        }

        if (string.Equals(databaseName, "postgres", StringComparison.OrdinalIgnoreCase)
            || string.Equals(databaseName, "template0", StringComparison.OrdinalIgnoreCase)
            || string.Equals(databaseName, "template1", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"不允许直接恢复系统数据库 {databaseName}。");
        }
    }

    private static string QuotePostgresIdentifier(string identifier)
    {
        return $"\"{identifier.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    }

    private static bool IsSqlDumpExtension(string extension)
    {
        return string.Equals(extension, ".sql", StringComparison.OrdinalIgnoreCase);
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

    private static void EnsureUserIsNotAdminTarget(User user)
    {
        if (IsAdminRole(user.Role))
        {
            throw new InvalidOperationException("不允许对管理员账号执行该操作。");
        }
    }

    private static void EnsureUsersDoNotContainAdminTargets(IEnumerable<User> users)
    {
        if (users.Any(user => IsAdminRole(user.Role)))
        {
            throw new InvalidOperationException("所选用户中包含管理员账号，当前操作已被拒绝。");
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

    private sealed class ProcessExecutionResult
    {
        public int ExitCode { get; set; }
        public string StandardOutput { get; set; } = string.Empty;
        public string StandardError { get; set; } = string.Empty;

        public string GetErrorMessage()
        {
            if (!string.IsNullOrWhiteSpace(StandardError))
            {
                return StandardError.Trim();
            }

            if (!string.IsNullOrWhiteSpace(StandardOutput))
            {
                return StandardOutput.Trim();
            }

            return "process exited with a non-zero status.";
        }
    }

    private sealed class DockerContainerMatch
    {
        public string ContainerId { get; set; } = string.Empty;
        public string Image { get; set; } = string.Empty;
        public string ContainerName { get; set; } = string.Empty;
        public string Ports { get; set; } = string.Empty;
        public int ContainerPort { get; set; } = 5432;
    }
}
