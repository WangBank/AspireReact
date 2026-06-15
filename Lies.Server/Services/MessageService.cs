using Lies.Server.Data;
using Lies.Server.DTOs;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lies.Server.Services;

public interface IMessageService
{
    Task<List<MessageUserSummaryDto>> SearchUsersAsync(int currentUserId, string? keyword, int skip, int take, CancellationToken cancellationToken = default);
    Task<List<MessageContactDto>> GetContactsAsync(int currentUserId, string? keyword, CancellationToken cancellationToken = default);
    Task<MessageContactDto> UpsertContactAsync(int currentUserId, UpsertContactRequest request, CancellationToken cancellationToken = default);
    Task<MessageContactDto?> UpdateContactAsync(int currentUserId, int contactUserId, UpdateContactRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteContactAsync(int currentUserId, int contactUserId, CancellationToken cancellationToken = default);
    Task<MessageConversationSummaryDto> CreateOrGetDirectConversationAsync(int currentUserId, int targetUserId, CancellationToken cancellationToken = default);
    Task<List<MessageConversationSummaryDto>> GetConversationsAsync(int currentUserId, string? keyword, CancellationToken cancellationToken = default);
    Task<MessageConversationDetailDto?> GetConversationAsync(int currentUserId, int conversationId, int? beforeMessageId, int take, CancellationToken cancellationToken = default);
    Task<MessageSearchResultDto?> SearchConversationMessagesAsync(int currentUserId, int conversationId, string keyword, int skip, int take, CancellationToken cancellationToken = default);
    Task<GlobalMessageSearchResultDto> SearchAllMessagesAsync(int currentUserId, string keyword, int skip, int take, CancellationToken cancellationToken = default);
    Task<MessageConversationSummaryDto?> UpdateConversationSettingsAsync(int currentUserId, int conversationId, UpdateConversationSettingsRequest request, CancellationToken cancellationToken = default);
    Task<MessageMutationResultDto?> SendMessageAsync(int currentUserId, int conversationId, SendMessageRequest request, CancellationToken cancellationToken = default);
    Task<MessageFileDownloadResult?> GetMessageFileDownloadAsync(int currentUserId, int messageId, CancellationToken cancellationToken = default);
    Task<MessageMutationResultDto?> RecallMessageAsync(int currentUserId, int messageId, CancellationToken cancellationToken = default);
    Task<bool> MarkConversationReadAsync(int currentUserId, int conversationId, int? lastReadMessageId, CancellationToken cancellationToken = default);
    Task TouchPresenceAsync(int currentUserId, CancellationToken cancellationToken = default);
}

public sealed class MessageFileDownloadResult
{
    public required string AbsolutePath { get; init; }
    public required string ContentType { get; init; }
    public required string FileName { get; init; }
}

public class MessageService : IMessageService
{
    private static readonly HashSet<string> AllowedImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif"
    };

    private const long MaxImageSizeBytes = 8 * 1024 * 1024;
    private const long MaxFileSizeBytes = 25 * 1024 * 1024;
    private static readonly TimeSpan RecallWindow = TimeSpan.FromMinutes(2);
    private static readonly HashSet<string> AllowedFileExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".txt",
        ".md",
        ".csv",
        ".tsv",
        ".json",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".zip",
        ".rar",
        ".7z",
        ".rtf"
    };
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _environment;
    private readonly IMessagePresenceTracker _presenceTracker;
    private readonly ISensitiveWordService _sensitiveWordService;

    public MessageService(
        AppDbContext db,
        IWebHostEnvironment environment,
        IMessagePresenceTracker presenceTracker,
        ISensitiveWordService sensitiveWordService)
    {
        _db = db;
        _environment = environment;
        _presenceTracker = presenceTracker;
        _sensitiveWordService = sensitiveWordService;
    }

    public async Task<List<MessageUserSummaryDto>> SearchUsersAsync(int currentUserId, string? keyword, int skip, int take, CancellationToken cancellationToken = default)
    {
        var normalizedKeyword = keyword?.Trim();
        var contactIds = await _db.UserContacts
            .AsNoTracking()
            .Where(item => item.OwnerUserId == currentUserId)
            .Select(item => item.ContactUserId)
            .ToArrayAsync(cancellationToken);

        var query = _db.Users
            .AsNoTracking()
            .Where(item =>
                item.Id != currentUserId
                && item.IsActive
                && item.Role != "Admin"
                && !contactIds.Contains(item.Id));

        if (!string.IsNullOrWhiteSpace(normalizedKeyword))
        {
            var pattern = $"%{normalizedKeyword}%";
            query = query.Where(item =>
                EF.Functions.ILike(item.Username, pattern)
                || EF.Functions.ILike(item.Email, pattern));
        }

        var users = await query
            .OrderBy(item => item.Username)
            .Skip(Math.Max(skip, 0))
            .Take(Math.Clamp(take, 1, 50))
            .ToListAsync(cancellationToken);

        return users
            .Select(user => MapUserSummary(user, contact: null, isFriend: false))
            .ToList();
    }

    public async Task<List<MessageContactDto>> GetContactsAsync(int currentUserId, string? keyword, CancellationToken cancellationToken = default)
    {
        var normalizedKeyword = keyword?.Trim();
        var contacts = await _db.UserContacts
            .AsNoTracking()
            .Include(item => item.ContactUser)
            .Where(item => item.OwnerUserId == currentUserId && item.ContactUser != null && item.ContactUser.IsActive)
            .ToListAsync(cancellationToken);

        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(
            currentUserId,
            contacts.Select(item => item.ContactUserId).ToArray(),
            cancellationToken);
        var conversationMap = await GetConversationIdMapAsync(currentUserId, contacts.Select(item => item.ContactUserId).ToArray(), cancellationToken);

        return contacts
            .Where(item =>
                string.IsNullOrWhiteSpace(normalizedKeyword)
                || item.ContactUser!.Username.Contains(normalizedKeyword, StringComparison.OrdinalIgnoreCase)
                || (!string.IsNullOrWhiteSpace(item.Alias) && item.Alias.Contains(normalizedKeyword, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(item => item.IsPinned)
            .ThenBy(item => item.Alias ?? item.ContactUser!.Username)
            .Select(item => new MessageContactDto
            {
                ContactUserId = item.ContactUserId,
                Username = item.ContactUser!.Username,
                AvatarUrl = NormalizeAssetUrl(item.ContactUser.AvatarPath),
                IsOnline = IsUserOnline(item.ContactUser),
                LastSeenAt = item.ContactUser.LastSeenAt,
                Alias = item.Alias,
                IsFriend = peerUsersWhoAddedCurrentUser.Contains(item.ContactUserId),
                IsPinned = item.IsPinned,
                CreatedAt = item.CreatedAt,
                ConversationId = GetOptionalConversationId(conversationMap, item.ContactUserId)
            })
            .ToList();
    }

    public async Task<MessageContactDto> UpsertContactAsync(int currentUserId, UpsertContactRequest request, CancellationToken cancellationToken = default)
    {
        var targetUser = await GetValidPeerUserAsync(currentUserId, request.ContactUserId, cancellationToken);
        var contact = await _db.UserContacts
            .FirstOrDefaultAsync(item => item.OwnerUserId == currentUserId && item.ContactUserId == request.ContactUserId, cancellationToken);

        if (contact == null)
        {
            contact = new UserContact
            {
                OwnerUserId = currentUserId,
                ContactUserId = request.ContactUserId,
                Alias = NormalizeAlias(request.Alias),
                IsPinned = request.IsPinned,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.UserContacts.Add(contact);
        }
        else
        {
            contact.Alias = NormalizeAlias(request.Alias);
            contact.IsPinned = request.IsPinned;
            contact.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(cancellationToken);
        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(currentUserId, [request.ContactUserId], cancellationToken);
        var conversationMap = await GetConversationIdMapAsync(currentUserId, [request.ContactUserId], cancellationToken);

        return new MessageContactDto
        {
            ContactUserId = targetUser.Id,
            Username = targetUser.Username,
            AvatarUrl = NormalizeAssetUrl(targetUser.AvatarPath),
            IsOnline = IsUserOnline(targetUser),
            LastSeenAt = targetUser.LastSeenAt,
            Alias = contact.Alias,
            IsFriend = peerUsersWhoAddedCurrentUser.Contains(targetUser.Id),
            IsPinned = contact.IsPinned,
            CreatedAt = contact.CreatedAt,
            ConversationId = GetOptionalConversationId(conversationMap, targetUser.Id)
        };
    }

    public async Task<MessageContactDto?> UpdateContactAsync(int currentUserId, int contactUserId, UpdateContactRequest request, CancellationToken cancellationToken = default)
    {
        var contact = await _db.UserContacts
            .Include(item => item.ContactUser)
            .FirstOrDefaultAsync(item => item.OwnerUserId == currentUserId && item.ContactUserId == contactUserId, cancellationToken);

        if (contact?.ContactUser == null || !contact.ContactUser.IsActive)
        {
            return null;
        }

        contact.Alias = NormalizeAlias(request.Alias);
        contact.IsPinned = request.IsPinned;
        contact.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(currentUserId, [contactUserId], cancellationToken);
        var conversationMap = await GetConversationIdMapAsync(currentUserId, [contactUserId], cancellationToken);

        return new MessageContactDto
        {
            ContactUserId = contact.ContactUserId,
            Username = contact.ContactUser.Username,
            AvatarUrl = NormalizeAssetUrl(contact.ContactUser.AvatarPath),
            IsOnline = IsUserOnline(contact.ContactUser),
            LastSeenAt = contact.ContactUser.LastSeenAt,
            Alias = contact.Alias,
            IsFriend = peerUsersWhoAddedCurrentUser.Contains(contact.ContactUserId),
            IsPinned = contact.IsPinned,
            CreatedAt = contact.CreatedAt,
            ConversationId = GetOptionalConversationId(conversationMap, contact.ContactUserId)
        };
    }

    public async Task<bool> DeleteContactAsync(int currentUserId, int contactUserId, CancellationToken cancellationToken = default)
    {
        var contact = await _db.UserContacts
            .FirstOrDefaultAsync(item => item.OwnerUserId == currentUserId && item.ContactUserId == contactUserId, cancellationToken);
        if (contact == null)
        {
            return false;
        }

        _db.UserContacts.Remove(contact);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<MessageConversationSummaryDto> CreateOrGetDirectConversationAsync(int currentUserId, int targetUserId, CancellationToken cancellationToken = default)
    {
        await GetValidPeerUserAsync(currentUserId, targetUserId, cancellationToken);
        await EnsureUsersAreFriendsAsync(currentUserId, targetUserId, cancellationToken);
        var conversation = await EnsureDirectConversationAsync(currentUserId, targetUserId, cancellationToken);
        var summary = await BuildConversationSummaryAsync(currentUserId, conversation.Id, cancellationToken);
        return summary ?? throw new InvalidOperationException("会话创建失败");
    }

    public async Task<List<MessageConversationSummaryDto>> GetConversationsAsync(int currentUserId, string? keyword, CancellationToken cancellationToken = default)
    {
        var normalizedKeyword = keyword?.Trim();
        var participants = await _db.MessageConversationParticipants
            .Where(item => item.UserId == currentUserId)
            .Include(item => item.Conversation!)
                .ThenInclude(item => item.Participants!)
                    .ThenInclude(item => item.User)
            .ToListAsync(cancellationToken);

        var peerUserIds = participants
            .Select(item => GetPeerUserId(item, currentUserId))
            .Distinct()
            .ToArray();
        var conversationIds = participants.Select(item => item.ConversationId).ToArray();
        var contacts = await _db.UserContacts
            .AsNoTracking()
            .Where(item => item.OwnerUserId == currentUserId)
            .ToDictionaryAsync(item => item.ContactUserId, cancellationToken);
        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(currentUserId, peerUserIds, cancellationToken);

        var externalMessages = await _db.UserMessages
            .AsNoTracking()
            .Where(item => conversationIds.Contains(item.ConversationId) && item.SenderUserId != currentUserId)
            .Select(item => new { item.ConversationId, item.Id })
            .ToListAsync(cancellationToken);

        var unreadCountMap = participants.ToDictionary(
            item => item.ConversationId,
            item => externalMessages.Count(message => message.ConversationId == item.ConversationId && message.Id > (item.LastReadMessageId ?? 0)));

        var summaries = participants
            .Select(item =>
            {
                var peerUserId = GetPeerUserId(item, currentUserId);
                return BuildConversationSummary(
                    item,
                    contacts.GetValueOrDefault(peerUserId),
                    peerUsersWhoAddedCurrentUser.Contains(peerUserId),
                    unreadCountMap.GetValueOrDefault(item.ConversationId));
            })
            .Where(item => item != null)
            .Cast<MessageConversationSummaryDto>()
            .Where(item =>
                string.IsNullOrWhiteSpace(normalizedKeyword)
                || item.Peer.Username.Contains(normalizedKeyword, StringComparison.OrdinalIgnoreCase)
                || (!string.IsNullOrWhiteSpace(item.Peer.Alias) && item.Peer.Alias.Contains(normalizedKeyword, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrWhiteSpace(item.LastMessagePreview) && item.LastMessagePreview.Contains(normalizedKeyword, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(item => item.IsPinned)
            .ThenByDescending(item => item.LastMessageAt ?? DateTime.MinValue)
            .ToList();

        return summaries;
    }

    public async Task<MessageConversationDetailDto?> GetConversationAsync(int currentUserId, int conversationId, int? beforeMessageId, int take, CancellationToken cancellationToken = default)
    {
        var participant = await _db.MessageConversationParticipants
            .Where(item => item.UserId == currentUserId && item.ConversationId == conversationId)
            .Include(item => item.Conversation!)
                .ThenInclude(item => item.Participants!)
                    .ThenInclude(item => item.User)
            .FirstOrDefaultAsync(cancellationToken);

        if (participant?.Conversation == null)
        {
            return null;
        }

        var peerUserId = GetPeerUserId(participant, currentUserId);
        var contacts = await _db.UserContacts
            .AsNoTracking()
            .Where(item => item.OwnerUserId == currentUserId && item.ContactUserId == peerUserId)
            .ToDictionaryAsync(item => item.ContactUserId, cancellationToken);
        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(currentUserId, [peerUserId], cancellationToken);

        var summary = BuildConversationSummary(
            participant,
            contacts.GetValueOrDefault(peerUserId),
            peerUsersWhoAddedCurrentUser.Contains(peerUserId),
            unreadCount: 0)
            ?? throw new InvalidOperationException("会话数据异常");

        var query = _db.UserMessages
            .AsNoTracking()
            .Where(item => item.ConversationId == conversationId)
            .Include(item => item.SenderUser)
            .Include(item => item.ReplyToMessage!)
                .ThenInclude(item => item!.SenderUser)
            .OrderByDescending(item => item.Id);

        if (beforeMessageId.HasValue)
        {
            query = query.Where(item => item.Id < beforeMessageId.Value)
                .OrderByDescending(item => item.Id);
        }

        var requestedTake = Math.Clamp(take, 1, 100);
        var items = await query
            .Take(requestedTake + 1)
            .ToListAsync(cancellationToken);

        var hasMore = items.Count > requestedTake;
        var pageItems = items.Take(requestedTake).Reverse().ToList();

        return new MessageConversationDetailDto
        {
            Summary = summary,
            Messages = pageItems.Select(item => MapMessageItem(item, currentUserId)).ToList(),
            HasMore = hasMore,
            NextBeforeMessageId = hasMore && pageItems.Count > 0 ? pageItems[0].Id : null,
            LastReadMessageId = participant.LastReadMessageId
        };
    }

    public async Task<MessageSearchResultDto?> SearchConversationMessagesAsync(int currentUserId, int conversationId, string keyword, int skip, int take, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(keyword))
        {
            return new MessageSearchResultDto();
        }

        var isParticipant = await _db.MessageConversationParticipants
            .AsNoTracking()
            .AnyAsync(item => item.UserId == currentUserId && item.ConversationId == conversationId, cancellationToken);

        if (!isParticipant)
        {
            return null;
        }

        var query = _db.UserMessages
            .AsNoTracking()
            .Where(item => item.ConversationId == conversationId && (
                (item.TextContent != null && EF.Functions.ILike(item.TextContent, $"%{keyword.Trim()}%"))
                || (item.ImageFileName != null && EF.Functions.ILike(item.ImageFileName, $"%{keyword.Trim()}%"))
                || (item.FileName != null && EF.Functions.ILike(item.FileName, $"%{keyword.Trim()}%"))));

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(item => item.SenderUser)
            .Include(item => item.ReplyToMessage!)
                .ThenInclude(item => item!.SenderUser)
            .OrderByDescending(item => item.Id)
            .Skip(Math.Max(skip, 0))
            .Take(Math.Clamp(take, 1, 100))
            .ToListAsync(cancellationToken);

        return new MessageSearchResultDto
        {
            Total = total,
            Messages = items.Select(item => MapMessageItem(item, currentUserId)).ToList()
        };
    }

    public async Task<GlobalMessageSearchResultDto> SearchAllMessagesAsync(int currentUserId, string keyword, int skip, int take, CancellationToken cancellationToken = default)
    {
        var normalizedKeyword = keyword.Trim();
        if (string.IsNullOrWhiteSpace(normalizedKeyword))
        {
            return new GlobalMessageSearchResultDto();
        }

        var participants = await _db.MessageConversationParticipants
            .Where(item => item.UserId == currentUserId)
            .Include(item => item.Conversation!)
                .ThenInclude(item => item.Participants!)
                    .ThenInclude(item => item.User)
            .ToListAsync(cancellationToken);

        var conversationIds = participants.Select(item => item.ConversationId).Distinct().ToArray();
        if (conversationIds.Length == 0)
        {
            return new GlobalMessageSearchResultDto();
        }

        var peerUserIds = participants
            .Select(item => GetPeerUserId(item, currentUserId))
            .Distinct()
            .ToArray();

        var contacts = await _db.UserContacts
            .AsNoTracking()
            .Where(item => item.OwnerUserId == currentUserId && peerUserIds.Contains(item.ContactUserId))
            .ToDictionaryAsync(item => item.ContactUserId, cancellationToken);
        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(currentUserId, peerUserIds, cancellationToken);

        var summariesByConversationId = participants
            .Select(item =>
            {
                var peerUserId = GetPeerUserId(item, currentUserId);
                return BuildConversationSummary(
                    item,
                    contacts.GetValueOrDefault(peerUserId),
                    peerUsersWhoAddedCurrentUser.Contains(peerUserId),
                    unreadCount: 0);
            })
            .Where(item => item != null)
            .Cast<MessageConversationSummaryDto>()
            .ToDictionary(item => item.ConversationId);

        var pattern = $"%{normalizedKeyword}%";
        var query = _db.UserMessages
            .AsNoTracking()
            .Where(item => conversationIds.Contains(item.ConversationId) && (
                (item.TextContent != null && EF.Functions.ILike(item.TextContent, pattern))
                || (item.ImageFileName != null && EF.Functions.ILike(item.ImageFileName, pattern))
                || (item.FileName != null && EF.Functions.ILike(item.FileName, pattern))));

        var total = await query.CountAsync(cancellationToken);
        var messages = await query
            .Include(item => item.SenderUser)
            .Include(item => item.ReplyToMessage!)
                .ThenInclude(item => item!.SenderUser)
            .OrderByDescending(item => item.Id)
            .Skip(Math.Max(skip, 0))
            .Take(Math.Clamp(take, 1, 100))
            .ToListAsync(cancellationToken);

        return new GlobalMessageSearchResultDto
        {
            Total = total,
            Hits = messages
                .Where(item => summariesByConversationId.ContainsKey(item.ConversationId))
                .Select(item => new GlobalMessageSearchHitDto
                {
                    ConversationId = item.ConversationId,
                    Peer = summariesByConversationId[item.ConversationId].Peer,
                    Message = MapMessageItem(item, currentUserId)
                })
                .ToList()
        };
    }

    public async Task<MessageConversationSummaryDto?> UpdateConversationSettingsAsync(int currentUserId, int conversationId, UpdateConversationSettingsRequest request, CancellationToken cancellationToken = default)
    {
        var participant = await _db.MessageConversationParticipants
            .Include(item => item.Conversation!)
                .ThenInclude(item => item.Participants!)
                    .ThenInclude(item => item.User)
            .FirstOrDefaultAsync(item => item.UserId == currentUserId && item.ConversationId == conversationId, cancellationToken);

        if (participant == null)
        {
            return null;
        }

        participant.IsPinned = request.IsPinned;
        participant.IsMuted = request.IsMuted;
        await _db.SaveChangesAsync(cancellationToken);

        var peerUserId = GetPeerUserId(participant, currentUserId);
        var contact = await _db.UserContacts
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.OwnerUserId == currentUserId && item.ContactUserId == peerUserId, cancellationToken);
        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(currentUserId, [peerUserId], cancellationToken);

        var unreadCount = await _db.UserMessages
            .AsNoTracking()
            .CountAsync(item =>
                item.ConversationId == conversationId
                && item.SenderUserId != currentUserId
                && item.Id > (participant.LastReadMessageId ?? 0), cancellationToken);

        return BuildConversationSummary(participant, contact, peerUsersWhoAddedCurrentUser.Contains(peerUserId), unreadCount);
    }

    public async Task<MessageMutationResultDto?> SendMessageAsync(int currentUserId, int conversationId, SendMessageRequest request, CancellationToken cancellationToken = default)
    {
        var participant = await _db.MessageConversationParticipants
            .Include(item => item.Conversation)
            .FirstOrDefaultAsync(item => item.UserId == currentUserId && item.ConversationId == conversationId, cancellationToken);

        if (participant?.Conversation == null)
        {
            return null;
        }

        var peerUserId = await _db.MessageConversationParticipants
            .AsNoTracking()
            .Where(item => item.ConversationId == conversationId && item.UserId != currentUserId)
            .Select(item => (int?)item.UserId)
            .FirstOrDefaultAsync(cancellationToken);
        if (!peerUserId.HasValue)
        {
            throw new InvalidOperationException("会话参与人数据异常");
        }

        await EnsureUsersAreFriendsAsync(currentUserId, peerUserId.Value, cancellationToken);

        var trimmedText = request.Text?.Trim();
        if (request.Image != null && request.File != null)
        {
            throw new InvalidOperationException("单条消息暂不支持同时上传图片和文件");
        }

        if (string.IsNullOrWhiteSpace(trimmedText) && request.Image == null && request.File == null)
        {
            throw new InvalidOperationException("消息内容、图片和文件不能同时为空");
        }

        var validation = await _sensitiveWordService.ValidateAsync(
            [new SensitiveWordInput("消息内容", trimmedText)],
            cancellationToken);
        if (!validation.IsValid)
        {
            throw new InvalidOperationException(validation.Message);
        }

        if (request.ReplyToMessageId.HasValue)
        {
            var replyToMessage = await _db.UserMessages
                .AsNoTracking()
                .Include(item => item.SenderUser)
                .FirstOrDefaultAsync(
                    item => item.Id == request.ReplyToMessageId.Value && item.ConversationId == conversationId,
                    cancellationToken);

            if (replyToMessage == null)
            {
                throw new InvalidOperationException("引用的原消息不存在或不属于当前会话");
            }
        }

        string? imageUrl = null;
        string? imageFileName = null;
        string? fileName = null;
        string? fileContentType = null;
        long? fileSizeBytes = null;
        string? fileStoragePath = null;
        if (request.Image != null)
        {
            (imageUrl, imageFileName) = await SaveMessageImageAsync(currentUserId, request.Image, cancellationToken);
        }
        else if (request.File != null)
        {
            (fileStoragePath, fileName, fileContentType, fileSizeBytes) = await SaveMessageFileAsync(currentUserId, request.File, cancellationToken);
        }

        var messageType = ResolveMessageType(trimmedText, imageUrl, fileStoragePath);
        var now = DateTime.UtcNow;
        var message = new UserMessage
        {
            ConversationId = conversationId,
            SenderUserId = currentUserId,
            MessageType = messageType,
            TextContent = string.IsNullOrWhiteSpace(trimmedText) ? null : trimmedText,
            ImageUrl = imageUrl,
            ImageFileName = imageFileName,
            FileName = fileName,
            FileContentType = fileContentType,
            FileSizeBytes = fileSizeBytes,
            FileStoragePath = fileStoragePath,
            ReplyToMessageId = request.ReplyToMessageId,
            CreatedAt = now
        };

        _db.UserMessages.Add(message);
        participant.LastReadAt = now;
        participant.Conversation.UpdatedAt = now;
        participant.Conversation.LastMessageAt = now;
        participant.Conversation.LastMessageType = messageType;
        participant.Conversation.LastMessagePreview = BuildLastMessagePreview(trimmedText, imageFileName, fileName);
        await _db.SaveChangesAsync(cancellationToken);

        participant.LastReadMessageId = message.Id;
        await _db.SaveChangesAsync(cancellationToken);

        var loadedMessage = await _db.UserMessages
            .AsNoTracking()
            .Include(item => item.SenderUser)
            .Include(item => item.ReplyToMessage!)
                .ThenInclude(item => item!.SenderUser)
            .FirstAsync(item => item.Id == message.Id, cancellationToken);

        var participantUserIds = await _db.MessageConversationParticipants
            .AsNoTracking()
            .Where(item => item.ConversationId == conversationId)
            .Select(item => item.UserId)
            .ToArrayAsync(cancellationToken);

        return new MessageMutationResultDto
        {
            Message = MapMessageItem(loadedMessage, currentUserId),
            ParticipantUserIds = participantUserIds,
            LastMessageAt = participant.Conversation.LastMessageAt,
            LastMessagePreview = participant.Conversation.LastMessagePreview,
            LastMessageType = participant.Conversation.LastMessageType
        };
    }

    public async Task<MessageFileDownloadResult?> GetMessageFileDownloadAsync(int currentUserId, int messageId, CancellationToken cancellationToken = default)
    {
        var message = await _db.UserMessages
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == messageId, cancellationToken);

        if (message == null
            || message.IsRecalled
            || string.IsNullOrWhiteSpace(message.FileStoragePath)
            || string.IsNullOrWhiteSpace(message.FileName))
        {
            return null;
        }

        var isParticipant = await _db.MessageConversationParticipants
            .AsNoTracking()
            .AnyAsync(item => item.ConversationId == message.ConversationId && item.UserId == currentUserId, cancellationToken);
        if (!isParticipant)
        {
            return null;
        }

        var absolutePath = Path.Combine(_environment.ContentRootPath, message.FileStoragePath.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(absolutePath))
        {
            return null;
        }

        return new MessageFileDownloadResult
        {
            AbsolutePath = absolutePath,
            ContentType = string.IsNullOrWhiteSpace(message.FileContentType)
                ? "application/octet-stream"
                : message.FileContentType,
            FileName = message.FileName
        };
    }

    public async Task<MessageMutationResultDto?> RecallMessageAsync(int currentUserId, int messageId, CancellationToken cancellationToken = default)
    {
        var message = await _db.UserMessages
            .Include(item => item.SenderUser)
            .Include(item => item.ReplyToMessage!)
                .ThenInclude(item => item!.SenderUser)
            .Include(item => item.Conversation)
            .FirstOrDefaultAsync(item => item.Id == messageId, cancellationToken);

        if (message == null)
        {
            return null;
        }

        var isParticipant = await _db.MessageConversationParticipants
            .AsNoTracking()
            .AnyAsync(item => item.ConversationId == message.ConversationId && item.UserId == currentUserId, cancellationToken);
        if (!isParticipant)
        {
            return null;
        }

        if (message.SenderUserId != currentUserId)
        {
            throw new InvalidOperationException("只能撤回自己发送的消息");
        }

        if (message.IsRecalled)
        {
            throw new InvalidOperationException("该消息已经撤回");
        }

        if (DateTime.UtcNow - message.CreatedAt > RecallWindow)
        {
            throw new InvalidOperationException("消息发送超过 2 分钟，不能再撤回");
        }

        message.IsRecalled = true;
        message.RecalledAt = DateTime.UtcNow;
        message.RecalledByUserId = currentUserId;
        message.MessageType = "recalled";
        message.TextContent = null;
        message.ImageUrl = null;
        message.ImageFileName = null;
        message.FileName = null;
        message.FileContentType = null;
        message.FileSizeBytes = null;
        message.FileStoragePath = null;

        if (message.Conversation != null
            && message.Conversation.LastMessageAt == message.CreatedAt)
        {
            message.Conversation.UpdatedAt = DateTime.UtcNow;
            message.Conversation.LastMessageType = "recalled";
            message.Conversation.LastMessagePreview = "[已撤回]";
        }

        await _db.SaveChangesAsync(cancellationToken);

        var participantUserIds = await _db.MessageConversationParticipants
            .AsNoTracking()
            .Where(item => item.ConversationId == message.ConversationId)
            .Select(item => item.UserId)
            .ToArrayAsync(cancellationToken);

        return new MessageMutationResultDto
        {
            Message = MapMessageItem(message, currentUserId),
            ParticipantUserIds = participantUserIds,
            LastMessageAt = message.Conversation?.LastMessageAt,
            LastMessagePreview = message.Conversation?.LastMessagePreview,
            LastMessageType = message.Conversation?.LastMessageType
        };
    }

    public async Task<bool> MarkConversationReadAsync(int currentUserId, int conversationId, int? lastReadMessageId, CancellationToken cancellationToken = default)
    {
        var participant = await _db.MessageConversationParticipants
            .FirstOrDefaultAsync(item => item.UserId == currentUserId && item.ConversationId == conversationId, cancellationToken);
        if (participant == null)
        {
            return false;
        }

        var resolvedLastReadMessageId = lastReadMessageId;
        if (!resolvedLastReadMessageId.HasValue)
        {
            resolvedLastReadMessageId = await _db.UserMessages
                .AsNoTracking()
                .Where(item => item.ConversationId == conversationId)
                .OrderByDescending(item => item.Id)
                .Select(item => (int?)item.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        participant.LastReadMessageId = resolvedLastReadMessageId;
        participant.LastReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task TouchPresenceAsync(int currentUserId, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(item => item.Id == currentUserId && item.IsActive, cancellationToken);
        if (user == null)
        {
            return;
        }

        var now = DateTime.UtcNow;
        if (user.LastSeenAt.HasValue && now - user.LastSeenAt.Value < TimeSpan.FromSeconds(30))
        {
            return;
        }

        user.LastSeenAt = now;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<User> GetValidPeerUserAsync(int currentUserId, int targetUserId, CancellationToken cancellationToken)
    {
        if (targetUserId == currentUserId)
        {
            throw new InvalidOperationException("不能把自己添加为联系人");
        }

        var targetUser = await _db.Users.FirstOrDefaultAsync(
            item => item.Id == targetUserId && item.IsActive && item.Role != "Admin",
            cancellationToken);

        return targetUser ?? throw new InvalidOperationException("目标用户不存在或不可用");
    }

    private async Task EnsureUsersAreFriendsAsync(int currentUserId, int targetUserId, CancellationToken cancellationToken)
    {
        var contactRelations = await _db.UserContacts
            .AsNoTracking()
            .Where(item =>
                (item.OwnerUserId == currentUserId && item.ContactUserId == targetUserId)
                || (item.OwnerUserId == targetUserId && item.ContactUserId == currentUserId))
            .Select(item => new { item.OwnerUserId, item.ContactUserId })
            .ToListAsync(cancellationToken);

        var currentUserAddedPeer = contactRelations.Any(item => item.OwnerUserId == currentUserId && item.ContactUserId == targetUserId);
        if (!currentUserAddedPeer)
        {
            throw new InvalidOperationException("请先把对方加入联系人后再发消息");
        }

        var peerAddedCurrentUser = contactRelations.Any(item => item.OwnerUserId == targetUserId && item.ContactUserId == currentUserId);
        if (!peerAddedCurrentUser)
        {
            throw new InvalidOperationException("对方尚未同意添加，暂时不能发消息");
        }
    }

    private async Task<MessageConversation> EnsureDirectConversationAsync(int currentUserId, int targetUserId, CancellationToken cancellationToken)
    {
        var pairKey = BuildPairKey(currentUserId, targetUserId);
        var existingConversation = await _db.MessageConversations
            .FirstOrDefaultAsync(item => item.PairKey == pairKey, cancellationToken);

        if (existingConversation != null)
        {
            return existingConversation;
        }

        var now = DateTime.UtcNow;
        var conversation = new MessageConversation
        {
            PairKey = pairKey,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.MessageConversations.Add(conversation);
        conversation.Participants =
        [
            new MessageConversationParticipant
            {
                UserId = currentUserId,
                CreatedAt = now
            },
            new MessageConversationParticipant
            {
                UserId = targetUserId,
                CreatedAt = now
            }
        ];

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return conversation;
        }
        catch (DbUpdateException)
        {
            return await _db.MessageConversations
                .FirstAsync(item => item.PairKey == pairKey, cancellationToken);
        }
    }

    private async Task<Dictionary<int, int>> GetConversationIdMapAsync(int currentUserId, IReadOnlyCollection<int> peerUserIds, CancellationToken cancellationToken)
    {
        if (peerUserIds.Count == 0)
        {
            return [];
        }

        var pairKeys = peerUserIds
            .Distinct()
            .ToDictionary(peerUserId => peerUserId, peerUserId => BuildPairKey(currentUserId, peerUserId));

        var conversations = await _db.MessageConversations
            .AsNoTracking()
            .Where(item => pairKeys.Values.Contains(item.PairKey))
            .ToListAsync(cancellationToken);

        return conversations.ToDictionary(
            item => pairKeys.First(pair => pair.Value == item.PairKey).Key,
            item => item.Id);
    }

    private async Task<HashSet<int>> GetPeerUsersWhoAddedCurrentUserAsync(int currentUserId, IReadOnlyCollection<int> peerUserIds, CancellationToken cancellationToken)
    {
        if (peerUserIds.Count == 0)
        {
            return [];
        }

        var normalizedPeerUserIds = peerUserIds
            .Where(item => item != currentUserId)
            .Distinct()
            .ToArray();
        if (normalizedPeerUserIds.Length == 0)
        {
            return [];
        }

        var ownerUserIds = await _db.UserContacts
            .AsNoTracking()
            .Where(item => normalizedPeerUserIds.Contains(item.OwnerUserId) && item.ContactUserId == currentUserId)
            .Select(item => item.OwnerUserId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return ownerUserIds.ToHashSet();
    }

    private async Task<MessageConversationSummaryDto?> BuildConversationSummaryAsync(int currentUserId, int conversationId, CancellationToken cancellationToken)
    {
        var participant = await _db.MessageConversationParticipants
            .Where(item => item.UserId == currentUserId && item.ConversationId == conversationId)
            .Include(item => item.Conversation!)
                .ThenInclude(item => item.Participants!)
                    .ThenInclude(item => item.User)
            .FirstOrDefaultAsync(cancellationToken);

        if (participant == null)
        {
            return null;
        }

        var peerUserId = GetPeerUserId(participant, currentUserId);
        var contact = await _db.UserContacts
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.OwnerUserId == currentUserId && item.ContactUserId == peerUserId, cancellationToken);
        var peerUsersWhoAddedCurrentUser = await GetPeerUsersWhoAddedCurrentUserAsync(currentUserId, [peerUserId], cancellationToken);

        var unreadCount = await _db.UserMessages
            .AsNoTracking()
            .CountAsync(item =>
                item.ConversationId == conversationId
                && item.SenderUserId != currentUserId
                && item.Id > (participant.LastReadMessageId ?? 0), cancellationToken);

        return BuildConversationSummary(participant, contact, peerUsersWhoAddedCurrentUser.Contains(peerUserId), unreadCount);
    }

    private MessageConversationSummaryDto? BuildConversationSummary(MessageConversationParticipant participant, UserContact? contact, bool isFriend, int unreadCount)
    {
        var peer = participant.Conversation?.Participants?.FirstOrDefault(item => item.UserId != participant.UserId)?.User;
        if (peer == null || !peer.IsActive)
        {
            return null;
        }

        return new MessageConversationSummaryDto
        {
            ConversationId = participant.ConversationId,
            Peer = MapUserSummary(peer, contact, isFriend),
            IsPinned = participant.IsPinned,
            IsMuted = participant.IsMuted,
            UnreadCount = unreadCount,
            LastMessageAt = participant.Conversation?.LastMessageAt,
            LastMessagePreview = participant.Conversation?.LastMessagePreview,
            LastMessageType = participant.Conversation?.LastMessageType
        };
    }

    private static int GetPeerUserId(MessageConversationParticipant participant, int currentUserId)
    {
        return participant.Conversation?.Participants?.First(item => item.UserId != currentUserId).UserId
            ?? throw new InvalidOperationException("会话参与人数据异常");
    }

    private MessageUserSummaryDto MapUserSummary(User user, UserContact? contact, bool isFriend)
    {
        return new MessageUserSummaryDto
        {
            Id = user.Id,
            Username = user.Username,
            AvatarUrl = NormalizeAssetUrl(user.AvatarPath),
            IsOnline = IsUserOnline(user),
            LastSeenAt = user.LastSeenAt,
            IsContact = contact != null,
            IsFriend = isFriend,
            Alias = contact?.Alias
        };
    }

    private static int? GetOptionalConversationId(IReadOnlyDictionary<int, int> conversationMap, int peerUserId)
    {
        return conversationMap.TryGetValue(peerUserId, out var conversationId)
            ? conversationId
            : null;
    }

    private bool IsUserOnline(User user)
    {
        if (_presenceTracker.IsUserOnline(user.Id))
        {
            return true;
        }

        return user.LastSeenAt.HasValue && DateTime.UtcNow - user.LastSeenAt.Value <= TimeSpan.FromMinutes(2);
    }

    private async Task<(string ImageUrl, string FileName)> SaveMessageImageAsync(int currentUserId, IFormFile image, CancellationToken cancellationToken)
    {
        if (image.Length <= 0)
        {
            throw new InvalidOperationException("图片文件不能为空");
        }

        if (image.Length > MaxImageSizeBytes)
        {
            throw new InvalidOperationException("图片大小不能超过 8MB");
        }

        if (!string.IsNullOrWhiteSpace(image.ContentType) && !AllowedImageContentTypes.Contains(image.ContentType))
        {
            throw new InvalidOperationException("仅支持 PNG、JPG、JPEG、WebP、GIF 图片");
        }

        var extension = Path.GetExtension(image.FileName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".png";
        }

        var now = DateTime.UtcNow;
        var relativeDirectory = Path.Combine("uploads", "messages", currentUserId.ToString(), now.ToString("yyyyMM"));
        var rootDirectory = _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
        var absoluteDirectory = Path.Combine(rootDirectory, relativeDirectory);
        Directory.CreateDirectory(absoluteDirectory);

        var fileName = $"msg-{currentUserId}-{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var absolutePath = Path.Combine(absoluteDirectory, fileName);
        await using var stream = File.Create(absolutePath);
        await image.CopyToAsync(stream, cancellationToken);

        var url = "/" + Path.Combine(relativeDirectory, fileName).Replace(Path.DirectorySeparatorChar, '/');
        return (url, fileName);
    }

    private async Task<(string StoragePath, string FileName, string ContentType, long FileSizeBytes)> SaveMessageFileAsync(
        int currentUserId,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file.Length <= 0)
        {
            throw new InvalidOperationException("文件不能为空");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            throw new InvalidOperationException("文件大小不能超过 25MB");
        }

        var originalFileName = Path.GetFileName(file.FileName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(originalFileName))
        {
            throw new InvalidOperationException("文件名无效");
        }

        var extension = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedFileExtensions.Contains(extension))
        {
            throw new InvalidOperationException("当前仅支持 PDF、文档、表格、演示文稿、文本和常见压缩包文件");
        }

        var now = DateTime.UtcNow;
        var relativeDirectory = Path.Combine("private_uploads", "messages", currentUserId.ToString(), now.ToString("yyyyMM"));
        var absoluteDirectory = Path.Combine(_environment.ContentRootPath, relativeDirectory);
        Directory.CreateDirectory(absoluteDirectory);

        var storedFileName = $"file-{currentUserId}-{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var absolutePath = Path.Combine(absoluteDirectory, storedFileName);
        await using var stream = File.Create(absolutePath);
        await file.CopyToAsync(stream, cancellationToken);

        return (
            Path.Combine(relativeDirectory, storedFileName).Replace(Path.DirectorySeparatorChar, '/'),
            originalFileName,
            string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            file.Length);
    }

    private static string ResolveMessageType(string? trimmedText, string? imageUrl, string? fileStoragePath)
    {
        if (!string.IsNullOrWhiteSpace(trimmedText) && (!string.IsNullOrWhiteSpace(imageUrl) || !string.IsNullOrWhiteSpace(fileStoragePath)))
        {
            return "mixed";
        }

        if (!string.IsNullOrWhiteSpace(imageUrl))
        {
            return "image";
        }

        return !string.IsNullOrWhiteSpace(fileStoragePath) ? "file" : "text";
    }

    private static string BuildLastMessagePreview(string? text, string? imageFileName, string? fileName)
    {
        if (!string.IsNullOrWhiteSpace(text) && !string.IsNullOrWhiteSpace(imageFileName))
        {
            return $"[图片] {TrimPreview(text)}";
        }

        if (!string.IsNullOrWhiteSpace(text) && !string.IsNullOrWhiteSpace(fileName))
        {
            return $"[文件] {TrimPreview(text)}";
        }

        if (!string.IsNullOrWhiteSpace(text))
        {
            return TrimPreview(text);
        }

        if (!string.IsNullOrWhiteSpace(imageFileName))
        {
            return $"[图片] {imageFileName}";
        }

        return string.IsNullOrWhiteSpace(fileName) ? "[消息]" : $"[文件] {fileName}";
    }

    private static string TrimPreview(string text)
    {
        var trimmed = text.Trim();
        return trimmed.Length <= 80 ? trimmed : $"{trimmed[..80]}...";
    }

    private MessageItemDto MapMessageItem(UserMessage message, int currentUserId)
    {
        return new MessageItemDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderUserId = message.SenderUserId,
            SenderUsername = message.SenderUser?.Username ?? string.Empty,
            SenderAvatarUrl = NormalizeAssetUrl(message.SenderUser?.AvatarPath),
            MessageType = message.MessageType,
            TextContent = message.TextContent,
            ImageUrl = NormalizeAssetUrl(message.ImageUrl),
            ImageFileName = message.ImageFileName,
            FileName = message.FileName,
            FileContentType = message.FileContentType,
            FileSizeBytes = message.FileSizeBytes,
            ReplyToMessageId = message.ReplyToMessageId,
            ReplyToMessage = MapReplySummary(message.ReplyToMessage),
            IsRecalled = message.IsRecalled,
            CanRecall = message.SenderUserId == currentUserId
                && !message.IsRecalled
                && DateTime.UtcNow - message.CreatedAt <= RecallWindow,
            CreatedAt = message.CreatedAt,
            IsMine = message.SenderUserId == currentUserId
        };
    }

    private static MessageReplySummaryDto? MapReplySummary(UserMessage? message)
    {
        if (message == null)
        {
            return null;
        }

        return new MessageReplySummaryDto
        {
            Id = message.Id,
            SenderUsername = message.SenderUser?.Username ?? string.Empty,
            TextContent = message.IsRecalled ? null : message.TextContent,
            ImageFileName = message.IsRecalled ? null : message.ImageFileName,
            FileName = message.IsRecalled ? null : message.FileName,
            IsRecalled = message.IsRecalled
        };
    }

    private static string BuildPairKey(int leftUserId, int rightUserId)
    {
        return leftUserId < rightUserId
            ? $"{leftUserId}:{rightUserId}"
            : $"{rightUserId}:{leftUserId}";
    }

    private static string? NormalizeAlias(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string? NormalizeAssetUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.StartsWith('/') ? value : $"/{value}";
    }
}
