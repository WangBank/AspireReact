using System.ComponentModel.DataAnnotations;

namespace Lies.Server.DTOs;

public class MessageUserSummaryDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public bool IsContact { get; set; }
    public bool IsFriend { get; set; }
    public string? Alias { get; set; }
}

public class MessageContactDto
{
    public int ContactUserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public string? Alias { get; set; }
    public bool IsFriend { get; set; }
    public bool IsPinned { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? ConversationId { get; set; }
}

public class MessageConversationSummaryDto
{
    public int ConversationId { get; set; }
    public MessageUserSummaryDto Peer { get; set; } = new();
    public bool IsPinned { get; set; }
    public bool IsMuted { get; set; }
    public int UnreadCount { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public string? LastMessagePreview { get; set; }
    public string? LastMessageType { get; set; }
}

public class MessageItemDto
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public int SenderUserId { get; set; }
    public string SenderUsername { get; set; } = string.Empty;
    public string? SenderAvatarUrl { get; set; }
    public string MessageType { get; set; } = "text";
    public string? TextContent { get; set; }
    public string? ImageUrl { get; set; }
    public string? ImageFileName { get; set; }
    public string? FileName { get; set; }
    public string? FileContentType { get; set; }
    public long? FileSizeBytes { get; set; }
    public int? ReplyToMessageId { get; set; }
    public MessageReplySummaryDto? ReplyToMessage { get; set; }
    public bool IsRecalled { get; set; }
    public bool CanRecall { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsMine { get; set; }
}

public class MessageReplySummaryDto
{
    public int Id { get; set; }
    public string SenderUsername { get; set; } = string.Empty;
    public string? TextContent { get; set; }
    public string? ImageFileName { get; set; }
    public string? FileName { get; set; }
    public bool IsRecalled { get; set; }
}

public class MessageConversationDetailDto
{
    public MessageConversationSummaryDto Summary { get; set; } = new();
    public List<MessageItemDto> Messages { get; set; } = [];
    public bool HasMore { get; set; }
    public int? NextBeforeMessageId { get; set; }
    public int? LastReadMessageId { get; set; }
}

public class MessageSearchResultDto
{
    public int Total { get; set; }
    public List<MessageItemDto> Messages { get; set; } = [];
}

public class GlobalMessageSearchHitDto
{
    public int ConversationId { get; set; }
    public MessageUserSummaryDto Peer { get; set; } = new();
    public MessageItemDto Message { get; set; } = new();
}

public class GlobalMessageSearchResultDto
{
    public int Total { get; set; }
    public List<GlobalMessageSearchHitDto> Hits { get; set; } = [];
}

public class CreateDirectConversationRequest
{
    [Required(ErrorMessage = "目标用户不能为空")]
    public int TargetUserId { get; set; }
}

public class UpsertContactRequest
{
    [Required(ErrorMessage = "联系人不能为空")]
    public int ContactUserId { get; set; }

    [MaxLength(100, ErrorMessage = "备注名最多 100 个字符")]
    public string? Alias { get; set; }

    public bool IsPinned { get; set; }
}

public class UpdateContactRequest
{
    [MaxLength(100, ErrorMessage = "备注名最多 100 个字符")]
    public string? Alias { get; set; }

    public bool IsPinned { get; set; }
}

public class MarkConversationReadRequest
{
    public int? LastReadMessageId { get; set; }
}

public class SendMessageRequest
{
    [MaxLength(4000, ErrorMessage = "消息内容最多 4000 个字符")]
    public string? Text { get; set; }

    public IFormFile? Image { get; set; }

    public IFormFile? File { get; set; }

    public int? ReplyToMessageId { get; set; }
}

public class UpdateConversationSettingsRequest
{
    public bool IsPinned { get; set; }
    public bool IsMuted { get; set; }
}

public class MessageMutationResultDto
{
    public MessageItemDto Message { get; set; } = new();
    public IReadOnlyCollection<int> ParticipantUserIds { get; set; } = [];
    public DateTime? LastMessageAt { get; set; }
    public string? LastMessagePreview { get; set; }
    public string? LastMessageType { get; set; }
}
