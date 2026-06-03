using Microsoft.EntityFrameworkCore;
using Lies.Server.Entities;

namespace Lies.Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AccountDaily> AccountDailies { get; set; }
    public DbSet<BankFlow> BankFlows { get; set; }
    public DbSet<StockTrade> StockTrades { get; set; }
    public DbSet<TradeNote> TradeNotes { get; set; }
    public DbSet<PortfolioImportAudit> PortfolioImportAudits { get; set; }
    public DbSet<StockBasic> StockBasics { get; set; }
    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 配置所有 DateTime 属性使用 UTC
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties()
                .Where(p => p.ClrType == typeof(DateTime) || p.ClrType == typeof(DateTime?)))
            {
                property.SetValueConverter(
                    new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
                        v => v.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(v, DateTimeKind.Utc) : v.ToUniversalTime(),
                        v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc)
                    ));
            }
        }

        modelBuilder.Entity<AccountDaily>().HasIndex(a => a.Date).IsUnique();
        modelBuilder.Entity<BankFlow>().HasIndex(b => b.Date);
        modelBuilder.Entity<StockTrade>().HasIndex(s => new { s.TradeDate, s.StockCode });
        modelBuilder.Entity<TradeNote>().HasIndex(t => new { t.Date, t.StockCode });
        modelBuilder.Entity<PortfolioImportAudit>().HasIndex(a => a.CreatedAt);
        modelBuilder.Entity<PortfolioImportAudit>().HasIndex(a => a.ImportDate);
        modelBuilder.Entity<PortfolioImportAudit>().HasIndex(a => a.SaveStatus);
        
        // StockBasic 配置
        modelBuilder.Entity<StockBasic>()
            .HasIndex(s => s.StockCode)
            .IsUnique();
        
        modelBuilder.Entity<StockBasic>()
            .HasIndex(s => new { s.StockCode, s.StockName, s.StockAbbr });

        // User 配置
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();
    }
}
