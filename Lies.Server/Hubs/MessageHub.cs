using Lies.Server.Data;
using Lies.Server.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Hubs;

public class MessageHub : Hub
{
    private readonly AppDbContext _db;
    private readonly IMessagePresenceTracker _presenceTracker;

    public MessageHub(AppDbContext db, IMessagePresenceTracker presenceTracker)
    {
        _db = db;
        _presenceTracker = presenceTracker;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        var role = Context.GetHttpContext()?.Items["UserRole"]?.ToString();
        if (!userId.HasValue || string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            Context.Abort();
            return;
        }

        _presenceTracker.RegisterConnection(userId.Value, Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, GetUserGroup(userId.Value));

        var user = await _db.Users.FirstOrDefaultAsync(item => item.Id == userId.Value && item.IsActive);
        if (user != null)
        {
            user.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await NotifyPresenceChangedAsync(user.Id, true, user.LastSeenAt.Value);
        }

        await Clients.Caller.SendAsync("Connected", new
        {
            userId = userId.Value,
            connectedAt = DateTime.UtcNow
        });

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = _presenceTracker.UnregisterConnection(Context.ConnectionId);
        if (userId.HasValue)
        {
            var user = await _db.Users.FirstOrDefaultAsync(item => item.Id == userId.Value && item.IsActive);
            if (user != null)
            {
                user.LastSeenAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                if (!_presenceTracker.IsUserOnline(userId.Value))
                {
                    await NotifyPresenceChangedAsync(user.Id, false, user.LastSeenAt.Value);
                }
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task Ping()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            Context.Abort();
            return;
        }

        var user = await _db.Users.FirstOrDefaultAsync(item => item.Id == userId.Value && item.IsActive);
        if (user != null)
        {
            user.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await NotifyPresenceChangedAsync(user.Id, true, user.LastSeenAt.Value);
        }
    }

    public static string GetUserGroup(int userId) => $"user_{userId}";

    private int? GetCurrentUserId()
    {
        var value = Context.GetHttpContext()?.Items["UserId"]?.ToString();
        return int.TryParse(value, out var userId) ? userId : null;
    }

    private async Task NotifyPresenceChangedAsync(int changedUserId, bool isOnline, DateTime lastSeenAt)
    {
        var audienceUserIds = await GetPresenceAudienceUserIdsAsync(changedUserId);
        if (audienceUserIds.Count == 0)
        {
            return;
        }

        await Clients.Groups(audienceUserIds.Select(GetUserGroup)).SendAsync("PresenceChanged", new
        {
            userId = changedUserId,
            isOnline,
            lastSeenAt
        });
    }

    private async Task<IReadOnlyCollection<int>> GetPresenceAudienceUserIdsAsync(int changedUserId)
    {
        var contactOwnerIds = await _db.UserContacts
            .AsNoTracking()
            .Where(item => item.ContactUserId == changedUserId)
            .Select(item => item.OwnerUserId)
            .Distinct()
            .ToArrayAsync();

        var conversationIds = await _db.MessageConversationParticipants
            .AsNoTracking()
            .Where(item => item.UserId == changedUserId)
            .Select(item => item.ConversationId)
            .ToArrayAsync();

        int[] participantUserIds = [];
        if (conversationIds.Length > 0)
        {
            participantUserIds = await _db.MessageConversationParticipants
                .AsNoTracking()
                .Where(item => conversationIds.Contains(item.ConversationId) && item.UserId != changedUserId)
                .Select(item => item.UserId)
                .Distinct()
                .ToArrayAsync();
        }

        return contactOwnerIds
            .Concat(participantUserIds)
            .Append(changedUserId)
            .Distinct()
            .ToArray();
    }
}
