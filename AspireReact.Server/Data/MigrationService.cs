using Microsoft.EntityFrameworkCore;

namespace AspireReact.Server.Data;

public class MigrationService<TContext> : IHostedService where TContext : DbContext
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MigrationService<TContext>> _logger;

    public MigrationService(IServiceProvider serviceProvider, ILogger<MigrationService<TContext>> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TContext>();
        
        _logger.LogInformation("正在应用数据库迁移...");
        await dbContext.Database.MigrateAsync(cancellationToken);
        _logger.LogInformation("数据库迁移完成");

        // 迁移完成后填充种子数据
        _logger.LogInformation("正在初始化数据库种子数据...");
        if (dbContext is AppDbContext appDbContext)
        {
            await DatabaseInitializer.InitializeAsync(appDbContext);
        }
        _logger.LogInformation("数据库种子数据初始化完成");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}