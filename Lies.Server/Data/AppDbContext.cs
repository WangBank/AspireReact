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
    public DbSet<QuickLoginToken> QuickLoginTokens { get; set; }
    public DbSet<MessageConversation> MessageConversations { get; set; }
    public DbSet<MessageConversationParticipant> MessageConversationParticipants { get; set; }
    public DbSet<UserContact> UserContacts { get; set; }
    public DbSet<UserFriendRequest> UserFriendRequests { get; set; }
    public DbSet<UserMessage> UserMessages { get; set; }
    public DbSet<StockBasic> StockBasics { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<SystemSetting> SystemSettings { get; set; }

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

        modelBuilder.Entity<AccountDaily>()
            .HasIndex(a => new { a.UserId, a.Date })
            .IsUnique();
        modelBuilder.Entity<BankFlow>()
            .HasIndex(b => new { b.UserId, b.Date });
        modelBuilder.Entity<StockTrade>()
            .HasIndex(s => new { s.UserId, s.TradeDate, s.StockCode });
        modelBuilder.Entity<TradeNote>()
            .HasIndex(t => new { t.UserId, t.Date, t.StockCode });
        modelBuilder.Entity<PortfolioImportAudit>()
            .HasIndex(a => a.UserId);
        modelBuilder.Entity<PortfolioImportAudit>().HasIndex(a => a.CreatedAt);
        modelBuilder.Entity<PortfolioImportAudit>().HasIndex(a => a.ImportDate);
        modelBuilder.Entity<PortfolioImportAudit>().HasIndex(a => a.SaveStatus);
        modelBuilder.Entity<QuickLoginToken>().HasIndex(t => t.Selector).IsUnique();
        modelBuilder.Entity<QuickLoginToken>().HasIndex(t => new { t.UserId, t.ExpiresAt });
        modelBuilder.Entity<MessageConversation>().HasIndex(c => c.PairKey).IsUnique();
        modelBuilder.Entity<MessageConversation>().HasIndex(c => c.LastMessageAt);
        modelBuilder.Entity<MessageConversationParticipant>().HasIndex(p => new { p.ConversationId, p.UserId }).IsUnique();
        modelBuilder.Entity<MessageConversationParticipant>().HasIndex(p => new { p.UserId, p.IsPinned });
        modelBuilder.Entity<UserContact>().HasIndex(c => new { c.OwnerUserId, c.ContactUserId }).IsUnique();
        modelBuilder.Entity<UserContact>().HasIndex(c => new { c.OwnerUserId, c.IsPinned });
        modelBuilder.Entity<UserFriendRequest>().HasIndex(r => new { r.RequesterUserId, r.TargetUserId }).IsUnique();
        modelBuilder.Entity<UserFriendRequest>().HasIndex(r => new { r.TargetUserId, r.Status, r.CreatedAt });
        modelBuilder.Entity<UserMessage>().HasIndex(m => new { m.ConversationId, m.CreatedAt });
        modelBuilder.Entity<UserMessage>().HasIndex(m => new { m.SenderUserId, m.CreatedAt });
        modelBuilder.Entity<SystemSetting>().HasIndex(s => s.SettingKey).IsUnique();
        
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

        modelBuilder.Entity<AccountDaily>()
            .HasOne(a => a.User)
            .WithMany(u => u.AccountDailies)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<BankFlow>()
            .HasOne(b => b.User)
            .WithMany(u => u.BankFlows)
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<StockTrade>()
            .HasOne(s => s.User)
            .WithMany(u => u.StockTrades)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TradeNote>()
            .HasOne(t => t.User)
            .WithMany(u => u.TradeNotes)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<PortfolioImportAudit>()
            .HasOne(a => a.User)
            .WithMany(u => u.PortfolioImportAudits)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<QuickLoginToken>()
            .HasOne(t => t.User)
            .WithMany(u => u.QuickLoginTokens)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MessageConversationParticipant>()
            .HasOne(p => p.Conversation)
            .WithMany(c => c.Participants)
            .HasForeignKey(p => p.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MessageConversationParticipant>()
            .HasOne(p => p.User)
            .WithMany(u => u.MessageConversationParticipants)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserMessage>()
            .HasOne(m => m.Conversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserMessage>()
            .HasOne(m => m.SenderUser)
            .WithMany(u => u.SentMessages)
            .HasForeignKey(m => m.SenderUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserMessage>()
            .HasOne(m => m.ReplyToMessage)
            .WithMany(m => m.Replies)
            .HasForeignKey(m => m.ReplyToMessageId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<UserContact>()
            .HasOne(c => c.OwnerUser)
            .WithMany(u => u.OwnedContacts)
            .HasForeignKey(c => c.OwnerUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserContact>()
            .HasOne(c => c.ContactUser)
            .WithMany(u => u.ContactOfUsers)
            .HasForeignKey(c => c.ContactUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserFriendRequest>()
            .HasOne(r => r.RequesterUser)
            .WithMany(u => u.SentFriendRequests)
            .HasForeignKey(r => r.RequesterUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserFriendRequest>()
            .HasOne(r => r.TargetUser)
            .WithMany(u => u.ReceivedFriendRequests)
            .HasForeignKey(r => r.TargetUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SystemSetting>()
            .HasOne(s => s.UpdatedByUser)
            .WithMany(u => u.UpdatedSystemSettings)
            .HasForeignKey(s => s.UpdatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
