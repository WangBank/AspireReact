import { makeAutoObservable, runInAction } from 'mobx';
import type { HubConnection } from '@microsoft/signalr';
import {
  messageService,
  type MessageContact,
  type MessageConversationDetail,
  type MessageConversationSummary,
  type GlobalMessageSearchResult,
  type MessageItem,
  type MessageSearchResult,
  type MessageUserSummary,
} from '../services/MessageService';

type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

const buildConversationPreview = (message: MessageItem): string => {
  if (message.textContent?.trim()) {
    return message.messageType === 'mixed'
      ? `[图片] ${message.textContent.trim().slice(0, 80)}`
      : message.textContent.trim().slice(0, 80);
  }

  return message.imageFileName ? `[图片] ${message.imageFileName}` : '[消息]';
};

export class MessageStore {
  conversations: MessageConversationSummary[] = [];
  contacts: MessageContact[] = [];
  currentConversation: MessageConversationDetail | null = null;
  selectedConversationId: number | null = null;
  userSearchResults: MessageUserSummary[] = [];
  messageSearchResult: MessageSearchResult | null = null;
  globalMessageSearchResult: GlobalMessageSearchResult | null = null;
  loading = false;
  conversationsLoading = false;
  contactsLoading = false;
  messagesLoading = false;
  searchingUsers = false;
  searchingMessages = false;
  sending = false;
  realtimeStatus: RealtimeStatus = 'disconnected';
  error: string | null = null;
  lastUserSearchKeyword: string | null = null;
  lastUserSearchSkip = 0;
  highlightedMessageId: number | null = null;
  private connection: HubConnection | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  initialize = async () => {
    this.loading = true;
    this.error = null;
    try {
      await Promise.all([
        this.loadConversations(),
        this.loadContacts(),
      ]);
      if (!this.selectedConversationId && this.conversations.length > 0) {
        await this.selectConversation(this.conversations[0].conversationId);
      }
      await this.connectRealtime();
      runInAction(() => {
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '消息模块加载失败';
        this.loading = false;
      });
    }
  };

  dispose = async () => {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {
        // ignore
      }
    }

    runInAction(() => {
      this.connection = null;
      this.realtimeStatus = 'disconnected';
    });
  };

  loadConversations = async (keyword = '') => {
    this.conversationsLoading = true;
    try {
      const data = await messageService.getConversations(keyword);
      runInAction(() => {
        this.conversations = data;
        this.conversationsLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '加载会话失败';
        this.conversationsLoading = false;
      });
    }
  };

  loadContacts = async (keyword = '') => {
    this.contactsLoading = true;
    try {
      const data = await messageService.getContacts(keyword);
      runInAction(() => {
        this.contacts = data;
        this.contactsLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '加载联系人失败';
        this.contactsLoading = false;
      });
    }
  };

  selectConversation = async (conversationId: number) => {
    this.messagesLoading = true;
    this.error = null;
    this.selectedConversationId = conversationId;
    this.messageSearchResult = null;
    try {
      const detail = await messageService.getConversation(conversationId);
      runInAction(() => {
        this.currentConversation = detail;
        this.messagesLoading = false;
      });

      const lastMessage = detail.messages.length > 0
        ? detail.messages[detail.messages.length - 1]
        : null;
      const lastMessageId = lastMessage?.id ?? detail.lastReadMessageId;
      if (lastMessageId) {
        await this.markConversationRead(conversationId, lastMessageId);
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '加载会话详情失败';
        this.messagesLoading = false;
      });
    }
  };

  focusMessage = async (conversationId: number, messageId: number) => {
    this.messagesLoading = true;
    this.error = null;
    this.selectedConversationId = conversationId;
    this.messageSearchResult = null;

    try {
      let detail = await messageService.getConversation(conversationId);
      let guard = 0;

      while (!detail.messages.some((item) => item.id === messageId) && detail.hasMore && detail.nextBeforeMessageId && guard < 40) {
        const olderPage = await messageService.getConversation(conversationId, detail.nextBeforeMessageId);
        const existingIds = new Set(detail.messages.map((item) => item.id));
        const olderMessages = olderPage.messages.filter((item) => !existingIds.has(item.id));

        detail = {
          ...detail,
          summary: olderPage.summary,
          messages: [...olderMessages, ...detail.messages],
          hasMore: olderPage.hasMore,
          nextBeforeMessageId: olderPage.nextBeforeMessageId,
          lastReadMessageId: olderPage.lastReadMessageId ?? detail.lastReadMessageId,
        };
        guard += 1;
      }

      runInAction(() => {
        this.currentConversation = detail;
        this.messagesLoading = false;
        this.highlightedMessageId = messageId;
      });

      const lastMessage = detail.messages.length > 0
        ? detail.messages[detail.messages.length - 1]
        : null;
      const lastMessageId = lastMessage?.id ?? detail.lastReadMessageId;
      if (lastMessageId) {
        await this.markConversationRead(conversationId, lastMessageId);
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '定位消息失败';
        this.messagesLoading = false;
      });
    }
  };

  loadOlderMessages = async () => {
    if (!this.currentConversation?.hasMore || !this.selectedConversationId) {
      return;
    }

    this.messagesLoading = true;
    try {
      const detail = await messageService.getConversation(
        this.selectedConversationId,
        this.currentConversation.nextBeforeMessageId,
      );
      runInAction(() => {
        if (!this.currentConversation) {
          this.currentConversation = detail;
        } else {
          const existingIds = new Set(this.currentConversation.messages.map((item) => item.id));
          const olderMessages = detail.messages.filter((item) => !existingIds.has(item.id));
          this.currentConversation = {
            ...this.currentConversation,
            messages: [...olderMessages, ...this.currentConversation.messages],
            hasMore: detail.hasMore,
            nextBeforeMessageId: detail.nextBeforeMessageId,
          };
        }
        this.messagesLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '加载更多消息失败';
        this.messagesLoading = false;
      });
    }
  };

  searchUsers = async (keyword: string, skip = 0) => {
    this.searchingUsers = true;
    try {
      const normalizedKeyword = keyword.trim();
      const users = await messageService.searchUsers(normalizedKeyword, skip);
      runInAction(() => {
        this.lastUserSearchKeyword = normalizedKeyword;
        this.lastUserSearchSkip = Math.max(skip, 0);
        this.userSearchResults = users;
        this.searchingUsers = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '搜索用户失败';
        this.searchingUsers = false;
      });
    }
  };

  clearUserSearchResults = () => {
    this.lastUserSearchKeyword = null;
    this.lastUserSearchSkip = 0;
    this.userSearchResults = [];
  };

  upsertContact = async (contactUserId: number, alias?: string, isPinned = false) => {
    await messageService.upsertContact({ contactUserId, alias, isPinned });
    await Promise.all([this.loadContacts(), this.loadConversations()]);
    await this.refreshSelectedConversation();
    await this.refreshUserSearchResults();
  };

  updateContact = async (contactUserId: number, alias?: string, isPinned = false) => {
    await messageService.updateContact(contactUserId, { alias, isPinned });
    await Promise.all([this.loadContacts(), this.loadConversations()]);
    await this.refreshSelectedConversation();
    await this.refreshUserSearchResults();
  };

  deleteContact = async (contactUserId: number) => {
    await messageService.deleteContact(contactUserId);
    await Promise.all([this.loadContacts(), this.loadConversations()]);
    await this.refreshSelectedConversation();
    await this.refreshUserSearchResults();
  };

  startDirectConversation = async (targetUserId: number) => {
    const summary = await messageService.createOrGetDirectConversation(targetUserId);
    await Promise.all([this.loadConversations(), this.loadContacts()]);
    await this.selectConversation(summary.conversationId);
  };

  searchMessages = async (keyword: string) => {
    if (!this.selectedConversationId || !keyword.trim()) {
      runInAction(() => {
        this.messageSearchResult = null;
      });
      return;
    }

    this.searchingMessages = true;
    try {
      const result = await messageService.searchConversationMessages(this.selectedConversationId, keyword.trim());
      runInAction(() => {
        this.messageSearchResult = result;
        this.searchingMessages = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '搜索消息失败';
        this.searchingMessages = false;
      });
    }
  };

  searchAllMessages = async (keyword: string, skip = 0) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      runInAction(() => {
        this.globalMessageSearchResult = null;
      });
      return;
    }

    this.searchingMessages = true;
    try {
      const result = await messageService.searchAllMessages(normalizedKeyword, skip, 20);
      runInAction(() => {
        this.globalMessageSearchResult = result;
        this.searchingMessages = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '全局搜索消息失败';
        this.searchingMessages = false;
      });
    }
  };

  clearGlobalMessageSearch = () => {
    this.globalMessageSearchResult = null;
  };

  clearMessageSearch = () => {
    this.messageSearchResult = null;
  };

  sendMessage = async (text: string, image?: File | null, replyToMessageId?: number | null) => {
    if (!this.selectedConversationId) {
      return;
    }

    this.sending = true;
    try {
      const message = await messageService.sendMessage(this.selectedConversationId, { text, image, replyToMessageId });
      runInAction(() => {
        this.applyIncomingMessage(message);
        this.sending = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '发送消息失败';
        this.sending = false;
      });
    }
  };

  updateConversationSettings = async (conversationId: number, isPinned: boolean, isMuted: boolean) => {
    const summary = await messageService.updateConversationSettings(conversationId, { isPinned, isMuted });
    runInAction(() => {
      this.conversations = this.conversations
        .map((item) => item.conversationId === conversationId ? summary : item)
        .sort((left, right) => {
          if (left.isPinned !== right.isPinned) {
            return left.isPinned ? -1 : 1;
          }

          return (right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0)
            - (left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0);
        });

      if (this.currentConversation?.summary.conversationId === conversationId) {
        this.currentConversation = {
          ...this.currentConversation,
          summary,
        };
      }
    });
  };

  recallMessage = async (messageId: number) => {
    const updated = await messageService.recallMessage(messageId);
    runInAction(() => {
      this.applyUpdatedMessage(updated);
    });
  };

  highlightMessage = (messageId: number | null) => {
    this.highlightedMessageId = messageId;
  };

  markConversationRead = async (conversationId: number, lastReadMessageId?: number | null) => {
    try {
      await messageService.markConversationRead(conversationId, lastReadMessageId);
      runInAction(() => {
        this.conversations = this.conversations.map((item) => (
          item.conversationId === conversationId
            ? { ...item, unreadCount: 0 }
            : item
        ));

        if (this.currentConversation?.summary.conversationId === conversationId) {
          this.currentConversation = {
            ...this.currentConversation,
            lastReadMessageId: lastReadMessageId ?? this.currentConversation.lastReadMessageId,
          };
        }
      });
    } catch {
      // ignore read errors
    }
  };

  clearError = () => {
    this.error = null;
  };

  private async connectRealtime() {
    if (this.connection) {
      return;
    }

    const connection = messageService.createHubConnection();
    runInAction(() => {
      this.realtimeStatus = 'connecting';
    });

    connection.onreconnecting(() => {
      runInAction(() => {
        this.realtimeStatus = 'reconnecting';
      });
    });

    connection.onreconnected(() => {
      runInAction(() => {
        this.realtimeStatus = 'connected';
      });
      void this.loadConversations();
      if (this.selectedConversationId) {
        void this.selectConversation(this.selectedConversationId);
      }
    });

    connection.onclose(() => {
      runInAction(() => {
        this.realtimeStatus = 'disconnected';
      });
    });

    connection.on('NewMessage', (message: MessageItem) => {
      runInAction(() => {
        this.applyIncomingMessage(message);
      });

      if (!message.isMine && this.selectedConversationId === message.conversationId) {
        void this.markConversationRead(message.conversationId, message.id);
      }
    });

    connection.on('MessageUpdated', (event: {
      message: MessageItem;
      lastMessageAt: string | null;
      lastMessagePreview: string | null;
      lastMessageType: string | null;
    }) => {
      runInAction(() => {
        this.applyUpdatedMessage(event.message, {
          lastMessageAt: event.lastMessageAt,
          lastMessagePreview: event.lastMessagePreview,
          lastMessageType: event.lastMessageType,
        });
      });
    });

    connection.on('ConversationRead', (event: { conversationId: number }) => {
      runInAction(() => {
        this.conversations = this.conversations.map((item) => (
          item.conversationId === event.conversationId
            ? { ...item, unreadCount: 0 }
            : item
        ));
      });
    });

    connection.on('PresenceChanged', (event: { userId: number; isOnline: boolean; lastSeenAt: string }) => {
      runInAction(() => {
        this.applyPresenceChange(event.userId, event.isOnline, event.lastSeenAt);
      });
    });

    await connection.start();

    runInAction(() => {
      this.connection = connection;
      this.realtimeStatus = 'connected';
    });
  }

  private applyIncomingMessage(message: MessageItem) {
    if (this.currentConversation?.summary.conversationId === message.conversationId) {
      const exists = this.currentConversation.messages.some((item) => item.id === message.id);
      if (!exists) {
        this.currentConversation = {
          ...this.currentConversation,
          messages: [...this.currentConversation.messages, message],
        };
      }
    }

    let found = false;
    this.conversations = this.conversations
      .map((item) => {
        if (item.conversationId !== message.conversationId) {
          return item;
        }

        found = true;
        const unreadCount = message.isMine || this.selectedConversationId === message.conversationId
          ? 0
          : item.unreadCount + 1;

        return {
          ...item,
          unreadCount,
          lastMessageAt: message.createdAt,
          lastMessagePreview: buildConversationPreview(message),
          lastMessageType: message.messageType,
        };
      })
      .sort((left, right) => {
        if (left.isPinned !== right.isPinned) {
          return left.isPinned ? -1 : 1;
        }

        return (right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0)
          - (left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0);
      });

    if (!found) {
      void this.loadConversations();
    }
  }

  private applyUpdatedMessage(
    message: MessageItem,
    conversationPatch?: {
      lastMessageAt: string | null;
      lastMessagePreview: string | null;
      lastMessageType: string | null;
    },
  ) {
    if (this.currentConversation?.summary.conversationId === message.conversationId) {
      this.currentConversation = {
        ...this.currentConversation,
        messages: this.currentConversation.messages.map((item) => item.id === message.id ? message : item),
      };
    }

    this.messageSearchResult = this.messageSearchResult
      ? {
          ...this.messageSearchResult,
          messages: this.messageSearchResult.messages.map((item) => item.id === message.id ? message : item),
        }
      : null;

    this.globalMessageSearchResult = this.globalMessageSearchResult
      ? {
          ...this.globalMessageSearchResult,
          hits: this.globalMessageSearchResult.hits.map((item) => (
            item.message.id === message.id
              ? { ...item, message }
              : item
          )),
        }
      : null;

    if (conversationPatch) {
      this.conversations = this.conversations.map((item) => (
        item.conversationId === message.conversationId
          ? {
              ...item,
              lastMessageAt: conversationPatch.lastMessageAt,
              lastMessagePreview: conversationPatch.lastMessagePreview,
              lastMessageType: conversationPatch.lastMessageType,
            }
          : item
      ));

      if (this.currentConversation?.summary.conversationId === message.conversationId) {
        this.currentConversation = {
          ...this.currentConversation,
          summary: {
            ...this.currentConversation.summary,
            lastMessageAt: conversationPatch.lastMessageAt,
            lastMessagePreview: conversationPatch.lastMessagePreview,
            lastMessageType: conversationPatch.lastMessageType,
          },
        };
      }
    }
  }

  private applyPresenceChange(userId: number, isOnline: boolean, lastSeenAt: string) {
    this.conversations = this.conversations.map((item) => (
      item.peer.id === userId
        ? {
            ...item,
            peer: {
              ...item.peer,
              isOnline,
              lastSeenAt,
            },
          }
        : item
    ));

    this.contacts = this.contacts.map((item) => (
      item.contactUserId === userId
        ? {
            ...item,
            isOnline,
            lastSeenAt,
          }
        : item
    ));

    this.userSearchResults = this.userSearchResults.map((item) => (
      item.id === userId
        ? {
            ...item,
            isOnline,
            lastSeenAt,
          }
        : item
    ));

    if (this.currentConversation?.summary.peer.id === userId) {
      this.currentConversation = {
        ...this.currentConversation,
        summary: {
          ...this.currentConversation.summary,
          peer: {
            ...this.currentConversation.summary.peer,
            isOnline,
            lastSeenAt,
          },
        },
      };
    }
  }

  private async refreshSelectedConversation() {
    if (!this.selectedConversationId) {
      return;
    }

    try {
      const detail = await messageService.getConversation(this.selectedConversationId);
      runInAction(() => {
        this.currentConversation = detail;
      });
    } catch {
      // ignore refresh errors after contact maintenance
    }
  }

  private async refreshUserSearchResults() {
    if (this.lastUserSearchKeyword == null) {
      return;
    }

    await this.searchUsers(this.lastUserSearchKeyword, this.lastUserSearchSkip);
  }
}

export const messageStore = new MessageStore();
