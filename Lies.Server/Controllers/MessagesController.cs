using Lies.Server.DTOs;
using Lies.Server.Hubs;
using Lies.Server.Infrastructure;
using Lies.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Lies.Server.Controllers;

[ApiController]
[Route("api/messages")]
public class MessagesController : ControllerBase
{
    private readonly IMessageService _messageService;
    private readonly IHubContext<MessageHub> _messageHubContext;

    public MessagesController(IMessageService messageService, IHubContext<MessageHub> messageHubContext)
    {
        _messageService = messageService;
        _messageHubContext = messageHubContext;
    }

    [HttpGet("users")]
    public async Task<IActionResult> SearchUsers([FromQuery] string? keyword, [FromQuery] int skip = 0, [FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var users = await _messageService.SearchUsersAsync(userId, keyword, Math.Max(skip, 0), Math.Clamp(take, 1, 50), cancellationToken);
        return Ok(new { success = true, data = users, message = $"匹配到 {users.Count} 个用户" });
    }

    [HttpGet("contacts")]
    public async Task<IActionResult> GetContacts([FromQuery] string? keyword, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var contacts = await _messageService.GetContactsAsync(userId, keyword, cancellationToken);
        return Ok(new { success = true, data = contacts, message = $"查询到 {contacts.Count} 个联系人" });
    }

    [HttpPost("contacts")]
    public async Task<IActionResult> UpsertContact([FromBody] UpsertContactRequest request, CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        try
        {
            var contact = await _messageService.UpsertContactAsync(userId, request, cancellationToken);
            return Ok(new { success = true, data = contact, message = "联系人已保存" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPut("contacts/{contactUserId:int}")]
    public async Task<IActionResult> UpdateContact(int contactUserId, [FromBody] UpdateContactRequest request, CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var contact = await _messageService.UpdateContactAsync(userId, contactUserId, request, cancellationToken);
        if (contact == null)
        {
            return NotFound(new { success = false, message = "联系人不存在" });
        }

        return Ok(new { success = true, data = contact, message = "联系人已更新" });
    }

    [HttpDelete("contacts/{contactUserId:int}")]
    public async Task<IActionResult> DeleteContact(int contactUserId, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var deleted = await _messageService.DeleteContactAsync(userId, contactUserId, cancellationToken);
        if (!deleted)
        {
            return NotFound(new { success = false, message = "联系人不存在" });
        }

        return Ok(new { success = true, message = "联系人已删除" });
    }

    [HttpPost("conversations/direct")]
    public async Task<IActionResult> CreateOrGetDirectConversation([FromBody] CreateDirectConversationRequest request, CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "参数验证失败", errors = ModelState });
        }

        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        try
        {
            var conversation = await _messageService.CreateOrGetDirectConversationAsync(userId, request.TargetUserId, cancellationToken);
            return Ok(new { success = true, data = conversation, message = "会话已准备就绪" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations([FromQuery] string? keyword, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var conversations = await _messageService.GetConversationsAsync(userId, keyword, cancellationToken);
        return Ok(new { success = true, data = conversations, message = $"查询到 {conversations.Count} 个会话" });
    }

    [HttpGet("conversations/{conversationId:int}")]
    public async Task<IActionResult> GetConversation(int conversationId, [FromQuery] int? beforeMessageId, [FromQuery] int take = 50, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var conversation = await _messageService.GetConversationAsync(userId, conversationId, beforeMessageId, take, cancellationToken);
        if (conversation == null)
        {
            return NotFound(new { success = false, message = "会话不存在" });
        }

        return Ok(new { success = true, data = conversation, message = "会话详情加载成功" });
    }

    [HttpGet("conversations/{conversationId:int}/search")]
    public async Task<IActionResult> SearchConversationMessages(int conversationId, [FromQuery] string keyword, [FromQuery] int skip = 0, [FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var result = await _messageService.SearchConversationMessagesAsync(userId, conversationId, keyword, skip, take, cancellationToken);
        if (result == null)
        {
            return NotFound(new { success = false, message = "会话不存在" });
        }

        return Ok(new { success = true, data = result, message = $"匹配到 {result.Total} 条消息" });
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchAllMessages([FromQuery] string keyword, [FromQuery] int skip = 0, [FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var result = await _messageService.SearchAllMessagesAsync(userId, keyword, skip, take, cancellationToken);
        return Ok(new { success = true, data = result, message = $"匹配到 {result.Total} 条消息" });
    }

    [HttpPost("conversations/{conversationId:int}/read")]
    public async Task<IActionResult> MarkConversationRead(int conversationId, [FromBody] MarkConversationReadRequest? request, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var success = await _messageService.MarkConversationReadAsync(userId, conversationId, request?.LastReadMessageId, cancellationToken);
        if (!success)
        {
            return NotFound(new { success = false, message = "会话不存在" });
        }

        await _messageHubContext.Clients.Group(MessageHub.GetUserGroup(userId)).SendAsync("ConversationRead", new
        {
            conversationId,
            lastReadMessageId = request?.LastReadMessageId
        }, cancellationToken);

        return Ok(new { success = true, message = "已标记为已读" });
    }

    [HttpPut("conversations/{conversationId:int}/settings")]
    public async Task<IActionResult> UpdateConversationSettings(int conversationId, [FromBody] UpdateConversationSettingsRequest request, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        var summary = await _messageService.UpdateConversationSettingsAsync(userId, conversationId, request, cancellationToken);
        if (summary == null)
        {
            return NotFound(new { success = false, message = "会话不存在" });
        }

        return Ok(new { success = true, data = summary, message = "会话设置已更新" });
    }

    [HttpPost("conversations/{conversationId:int}/messages")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> SendMessage(int conversationId, [FromForm] SendMessageRequest request, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        try
        {
            var result = await _messageService.SendMessageAsync(userId, conversationId, request, cancellationToken);
            if (result == null)
            {
                return NotFound(new { success = false, message = "会话不存在" });
            }

            foreach (var participantUserId in result.ParticipantUserIds.Distinct())
            {
                await _messageHubContext.Clients
                    .Group(MessageHub.GetUserGroup(participantUserId))
                    .SendAsync("NewMessage", ProjectMessageForRecipient(result.Message, participantUserId), cancellationToken);
            }

            return Ok(new { success = true, data = result.Message, message = "消息发送成功" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPost("messages/{messageId:int}/recall")]
    public async Task<IActionResult> RecallMessage(int messageId, CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        try
        {
            var result = await _messageService.RecallMessageAsync(userId, messageId, cancellationToken);
            if (result == null)
            {
                return NotFound(new { success = false, message = "消息不存在或不属于当前用户会话" });
            }

            foreach (var participantUserId in result.ParticipantUserIds.Distinct())
            {
                await _messageHubContext.Clients
                    .Group(MessageHub.GetUserGroup(participantUserId))
                    .SendAsync("MessageUpdated", new
                    {
                        Message = ProjectMessageForRecipient(result.Message, participantUserId),
                        result.LastMessageAt,
                        result.LastMessagePreview,
                        result.LastMessageType
                    }, cancellationToken);
            }

            return Ok(new { success = true, data = result.Message, message = "消息已撤回" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPost("presence/heartbeat")]
    public async Task<IActionResult> Heartbeat(CancellationToken cancellationToken = default)
    {
        var authResult = this.RequireCurrentUser(out var userId);
        if (authResult != null)
        {
            return authResult;
        }

        await _messageService.TouchPresenceAsync(userId, cancellationToken);
        return Ok(new { success = true, message = "在线状态已更新" });
    }

    private static MessageItemDto ProjectMessageForRecipient(MessageItemDto source, int recipientUserId)
    {
        return new MessageItemDto
        {
            Id = source.Id,
            ConversationId = source.ConversationId,
            SenderUserId = source.SenderUserId,
            SenderUsername = source.SenderUsername,
            SenderAvatarUrl = source.SenderAvatarUrl,
            MessageType = source.MessageType,
            TextContent = source.TextContent,
            ImageUrl = source.ImageUrl,
            ImageFileName = source.ImageFileName,
            ReplyToMessageId = source.ReplyToMessageId,
            ReplyToMessage = source.ReplyToMessage,
            IsRecalled = source.IsRecalled,
            CanRecall = source.SenderUserId == recipientUserId && source.CanRecall,
            CreatedAt = source.CreatedAt,
            IsMine = source.SenderUserId == recipientUserId
        };
    }
}
