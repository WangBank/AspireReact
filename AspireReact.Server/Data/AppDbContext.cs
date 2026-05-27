using Microsoft.EntityFrameworkCore;
using AspireReact.Server.Entities;

namespace AspireReact.Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AccountDaily> AccountDailies { get; set; }
    public DbSet<BankFlow> BankFlows { get; set; }
    public DbSet<StockTrade> StockTrades { get; set; }
    public DbSet<TradeNote> TradeNotes { get; set; }
    public DbSet<StockBasic> StockBasics { get; set; }
    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccountDaily>().HasIndex(a => a.Date).IsUnique();
        modelBuilder.Entity<BankFlow>().HasIndex(b => b.Date);
        modelBuilder.Entity<StockTrade>().HasIndex(s => new { s.TradeDate, s.StockCode });
        modelBuilder.Entity<TradeNote>().HasIndex(t => new { t.Date, t.StockCode });
        
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