import { makeAutoObservable, runInAction } from 'mobx';
import type { HubConnection } from '@microsoft/signalr';
import {
  messageService,
  type MessageContact,
  type MessageConversationDetail,
  type MessageConversationSummary,
  type GlobalMessageSearchResult,
  type MessageFriendRequest,
  type MessageItem,
  type MessageSearchResult,
  type MessageUserSummary,
} from '../services/MessageService';

type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
type IncomingNotice = {
  key: string;
  conversationId: number;
  senderLabel: string;
  preview: string;
};

const buildConversationPreview = (message: MessageItem): string => {
  if (message.textContent?.trim()) {
    if (message.imageUrl || message.imageFileName) {
      return `[图片] ${message.textContent.trim().slice(0, 80)}`;
    }

    if (message.fileName) {
      return `[文件] ${message.textContent.trim().slice(0, 80)}`;
    }

    return message.textContent.trim().slice(0, 80);
  }

  if (message.imageFileName) {
    return `[图片] ${message.imageFileName}`;
  }

  return message.fileName ? `[文件] ${message.fileName}` : '[消息]';
};

export class MessageStore {
  conversations: MessageConversationSummary[] = [];
  contacts: MessageContact[] = [];
  friendRequests: MessageFriendRequest[] = [];
  currentConversation: MessageConversationDetail | null = null;
  selectedConversationId: number | null = null;
  userSearchResults: MessageUserSummary[] = [];
  messageSearchResult: MessageSearchResult | null = null;
  globalMessageSearchResult: GlobalMessageSearchResult | null = null;
  loading = false;
  conversationsLoading = false;
  contactsLoading = false;
  friendRequestsLoading = false;
  messagesLoading = false;
  searchingUsers = false;
  searchingMessages = false;
  sending = false;
  realtimeStatus: RealtimeStatus = 'disconnected';
  error: string | null = null;
  lastUserSearchKeyword: string | null = null;
  lastUserSearchSkip = 0;
  highlightedMessageId: number | null = null;
  incomingNotice: IncomingNotice | null = null;
  messagePageActive = false;
  private connection: HubConnection | null = null;
  private bootstrapPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get totalUnreadCount() {
    return this.conversations.reduce((total, item) => total + item.unreadCount, 0);
  }

  get pendingIncomingFriendRequestCount() {
    return this.friendRequests.filter((item) => item.direction === 'incoming' && item.status === 'pending').length;
  }

  get pendingOutgoingFriendRequestCount() {
    return this.friendRequests.filter((item) => item.direction === 'outgoing' && item.status === 'pending').length;
  }

  bootstrap = async () => {
    if (this.connection && this.conversations.length > 0) {
      return;
    }

    if (this.bootstrapPromise) {
      await this.bootstrapPromise;
      return;
    }

    this.bootstrapPromise = (async () => {
      await this.loadConversations();
      await this.connectRealtime();
    })();

    try {
      await this.bootstrapPromise;
    } finally {
      this.bootstrapPromise = null;
    }
  };

  initialize = async () => {
    this.loading = true;
    this.error = null;
    try {
      await Promise.all([
        this.bootstrap(),
        this.loadConversations(),
        this.loadContacts(),
        this.loadFriendRequests(),
      ]);
      if (!this.selectedConversationId && this.conversations.length > 0) {
        await this.selectConversation(this.conversations[0].conversationId);
      }
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
      this.conversations = [];
      this.contacts = [];
      this.friendRequests = [];
      this.currentConversation = null;
      this.selectedConversationId = null;
      this.userSearchResults = [];
      this.messageSearchResult = null;
      this.globalMessageSearchResult = null;
      this.loading = false;
      this.conversationsLoading = false;
      this.contactsLoading = false;
      this.friendRequestsLoading = false;
      this.messagesLoading = false;
      this.searchingUsers = false;
      this.searchingMessages = false;
      this.sending = false;
      this.error = null;
      this.lastUserSearchKeyword = null;
      this.lastUserSearchSkip = 0;
      this.highlightedMessageId = null;
      this.incomingNotice = null;
      this.messagePageActive = false;
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

  loadFriendRequests = async () => {
    this.friendRequestsLoading = true;
    try {
      const data = await messageService.getFriendRequests();
      runInAction(() => {
        this.friendRequests = data;
        this.friendRequestsLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '加载好友通知失败';
        this.friendRequestsLoading = false;
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

  createFriendRequest = async (targetUserId: number, requestMessage?: string, alias?: string) => {
    try {
      await messageService.createFriendRequest({ targetUserId, requestMessage, alias });
      await Promise.all([
        this.loadFriendRequests(),
        this.refreshUserSearchResults(),
        this.loadContacts(),
        this.loadConversations(),
      ]);
      await this.refreshSelectedConversation();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '发送好友申请失败';
      });
      throw err;
    }
  };

  respondFriendRequest = async (requestId: number, action: 'accept' | 'reject') => {
    try {
      await messageService.respondFriendRequest(requestId, { action });
      await Promise.all([
        this.loadFriendRequests(),
        this.refreshUserSearchResults(),
        this.loadContacts(),
        this.loadConversations(),
      ]);
      await this.refreshSelectedConversation();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '处理好友申请失败';
      });
      throw err;
    }
  };

  upsertContact = async (contactUserId: number, alias?: string, isPinned = false) => {
    try {
      await messageService.upsertContact({ contactUserId, alias, isPinned });
      await Promise.all([this.loadContacts(), this.loadConversations(), this.loadFriendRequests()]);
      await this.refreshSelectedConversation();
      await this.refreshUserSearchResults();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '保存联系人失败';
      });
      throw err;
    }
  };

  updateContact = async (contactUserId: number, alias?: string, isPinned = false) => {
    try {
      await messageService.updateContact(contactUserId, { alias, isPinned });
      await Promise.all([this.loadContacts(), this.loadConversations(), this.loadFriendRequests()]);
      await this.refreshSelectedConversation();
      await this.refreshUserSearchResults();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '更新联系人失败';
      });
      throw err;
    }
  };

  deleteContact = async (contactUserId: number) => {
    try {
      await messageService.deleteContact(contactUserId);
      await Promise.all([this.loadContacts(), this.loadConversations(), this.loadFriendRequests()]);
      await this.refreshSelectedConversation();
      await this.refreshUserSearchResults();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '删除联系人失败';
      });
      throw err;
    }
  };

  startDirectConversation = async (targetUserId: number) => {
    try {
      const summary = await messageService.createOrGetDirectConversation(targetUserId);
      await Promise.all([this.loadConversations(), this.loadContacts(), this.loadFriendRequests()]);
      await this.selectConversation(summary.conversationId);
      return true;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '发起会话失败';
      });
      return false;
    }
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

  sendMessage = async (text: string, attachment?: File | null, replyToMessageId?: number | null) => {
    if (!this.selectedConversationId) {
      return false;
    }

    if (this.currentConversation && !this.currentConversation.summary.peer.isFriend) {
      runInAction(() => {
        this.error = '只有互为联系人后才能继续发送消息';
      });
      return false;
    }

    this.sending = true;
    try {
      const message = await messageService.sendMessage(this.selectedConversationId, { text, attachment, replyToMessageId });
      runInAction(() => {
        this.applyIncomingMessage(message);
        this.sending = false;
      });
      return true;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '发送消息失败';
        this.sending = false;
      });
      return false;
    }
  };

  downloadMessageFile = async (messageId: number, preferredFileName: string) => {
    try {
      await messageService.downloadMessageFile(messageId, preferredFileName);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '文件下载失败';
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

        if (this.incomingNotice?.conversationId === conversationId) {
          this.incomingNotice = null;
        }

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

  dismissIncomingNotice = () => {
    this.incomingNotice = null;
  };

  setMessagePageActive = (active: boolean) => {
    this.messagePageActive = active;
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
      void this.loadContacts();
      void this.loadFriendRequests();
      void this.refreshUserSearchResults();
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

      if (!message.isMine && this.messagePageActive && this.selectedConversationId === message.conversationId) {
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

    connection.on('FriendRequestsChanged', () => {
      void this.loadFriendRequests();
      void this.loadContacts();
      void this.loadConversations();
      void this.refreshUserSearchResults();
      void this.refreshSelectedConversation();
    });

    connection.on('ContactsChanged', () => {
      void this.loadContacts();
      void this.loadConversations();
      void this.loadFriendRequests();
      void this.refreshUserSearchResults();
      void this.refreshSelectedConversation();
    });

    await connection.start();

    runInAction(() => {
      this.connection = connection;
      this.realtimeStatus = 'connected';
    });
  }

  private applyIncomingMessage(message: MessageItem) {
    const matchedConversation = this.conversations.find((item) => item.conversationId === message.conversationId) ?? null;

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
        const unreadCount = message.isMine || (this.messagePageActive && this.selectedConversationId === message.conversationId)
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

    if (!message.isMine && this.selectedConversationId !== message.conversationId && !matchedConversation?.isMuted) {
      this.incomingNotice = {
        key: `${message.id}-${message.createdAt}`,
        conversationId: message.conversationId,
        senderLabel: matchedConversation?.peer.alias?.trim() || matchedConversation?.peer.username || message.senderUsername,
        preview: buildConversationPreview(message),
      };
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
