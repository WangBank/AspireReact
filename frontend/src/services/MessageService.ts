import * as signalR from '@microsoft/signalr';
import { getAuthToken } from '../utils/authToken';

const API_BASE = '/api/messages';
const HUB_URL = '/messagehub';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface MessageUserSummary {
  id: number;
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  isContact: boolean;
  isFriend: boolean;
  alias: string | null;
}

export interface MessageContact {
  contactUserId: number;
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  alias: string | null;
  isFriend: boolean;
  isPinned: boolean;
  createdAt: string;
  conversationId: number | null;
}

export interface MessageConversationSummary {
  conversationId: number;
  peer: MessageUserSummary;
  isPinned: boolean;
  isMuted: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageType: string | null;
}

export interface MessageItem {
  id: number;
  conversationId: number;
  senderUserId: number;
  senderUsername: string;
  senderAvatarUrl: string | null;
  messageType: string;
  textContent: string | null;
  imageUrl: string | null;
  imageFileName: string | null;
  replyToMessageId: number | null;
  replyToMessage: MessageReplySummary | null;
  isRecalled: boolean;
  canRecall: boolean;
  createdAt: string;
  isMine: boolean;
}

export interface MessageReplySummary {
  id: number;
  senderUsername: string;
  textContent: string | null;
  imageFileName: string | null;
  isRecalled: boolean;
}

export interface MessageConversationDetail {
  summary: MessageConversationSummary;
  messages: MessageItem[];
  hasMore: boolean;
  nextBeforeMessageId: number | null;
  lastReadMessageId: number | null;
}

export interface MessageSearchResult {
  total: number;
  messages: MessageItem[];
}

export interface GlobalMessageSearchHit {
  conversationId: number;
  peer: MessageUserSummary;
  message: MessageItem;
}

export interface GlobalMessageSearchResult {
  total: number;
  hits: GlobalMessageSearchHit[];
}

export interface UpsertContactPayload {
  contactUserId: number;
  alias?: string;
  isPinned?: boolean;
}

export interface UpdateContactPayload {
  alias?: string;
  isPinned?: boolean;
}

export interface UpdateConversationSettingsPayload {
  isPinned: boolean;
  isMuted: boolean;
}

const UploadCompressionThresholdBytes = 2 * 1024 * 1024;
const UploadMaxDimension = 1920;

const buildAuthHeaders = (contentType = false): HeadersInit => {
  const token = getAuthToken();
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.message || '请求失败');
  }

  return json as T;
};

const loadImageElement = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('图片加载失败，无法压缩'));
  };

  image.src = objectUrl;
});

const maybeCompressImage = async (file: File): Promise<File> => {
  if (typeof window === 'undefined' || file.type === 'image/gif') {
    return file;
  }

  if (file.size <= UploadCompressionThresholdBytes) {
    return file;
  }

  const image = await loadImageElement(file);
  const scale = Math.min(1, UploadMaxDimension / Math.max(image.width, image.height));

  if (scale >= 1 && file.type === 'image/webp') {
    return file;
  }

  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.9);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  const normalizedName = file.name.replace(/\.[^.]+$/, '') || 'message-image';
  return new File([blob], `${normalizedName}.webp`, {
    type: 'image/webp',
    lastModified: file.lastModified,
  });
};

export class MessageService {
  async searchUsers(keyword = '', skip = 0, take = 20): Promise<MessageUserSummary[]> {
    const normalizedKeyword = keyword.trim();
    const query = normalizedKeyword
      ? `?keyword=${encodeURIComponent(normalizedKeyword)}&skip=${Math.max(skip, 0)}&take=${Math.max(take, 1)}`
      : `?skip=${Math.max(skip, 0)}&take=${Math.max(take, 1)}`;

    const response = await fetch(`${API_BASE}/users${query}`, {
      headers: buildAuthHeaders(),
    });

    const json = await parseJson<ApiResponse<MessageUserSummary[]>>(response);
    return json.data;
  }

  async getContacts(keyword = ''): Promise<MessageContact[]> {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
    const response = await fetch(`${API_BASE}/contacts${query}`, {
      headers: buildAuthHeaders(),
    });

    const json = await parseJson<ApiResponse<MessageContact[]>>(response);
    return json.data;
  }

  async upsertContact(payload: UpsertContactPayload): Promise<MessageContact> {
    const response = await fetch(`${API_BASE}/contacts`, {
      method: 'POST',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({
        contactUserId: payload.contactUserId,
        alias: payload.alias ?? null,
        isPinned: payload.isPinned ?? false,
      }),
    });

    const json = await parseJson<ApiResponse<MessageContact>>(response);
    return json.data;
  }

  async updateContact(contactUserId: number, payload: UpdateContactPayload): Promise<MessageContact> {
    const response = await fetch(`${API_BASE}/contacts/${contactUserId}`, {
      method: 'PUT',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({
        alias: payload.alias ?? null,
        isPinned: payload.isPinned ?? false,
      }),
    });

    const json = await parseJson<ApiResponse<MessageContact>>(response);
    return json.data;
  }

  async deleteContact(contactUserId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/contacts/${contactUserId}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(),
    });

    await parseJson<ApiResponse<null>>(response);
  }

  async createOrGetDirectConversation(targetUserId: number): Promise<MessageConversationSummary> {
    const response = await fetch(`${API_BASE}/conversations/direct`, {
      method: 'POST',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({ targetUserId }),
    });

    const json = await parseJson<ApiResponse<MessageConversationSummary>>(response);
    return json.data;
  }

  async getConversations(keyword = ''): Promise<MessageConversationSummary[]> {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
    const response = await fetch(`${API_BASE}/conversations${query}`, {
      headers: buildAuthHeaders(),
    });

    const json = await parseJson<ApiResponse<MessageConversationSummary[]>>(response);
    return json.data;
  }

  async getConversation(conversationId: number, beforeMessageId?: number | null): Promise<MessageConversationDetail> {
    const query = beforeMessageId ? `?beforeMessageId=${beforeMessageId}&take=50` : '?take=50';
    const response = await fetch(`${API_BASE}/conversations/${conversationId}${query}`, {
      headers: buildAuthHeaders(),
    });

    const json = await parseJson<ApiResponse<MessageConversationDetail>>(response);
    return json.data;
  }

  async searchConversationMessages(conversationId: number, keyword: string): Promise<MessageSearchResult> {
    const response = await fetch(
      `${API_BASE}/conversations/${conversationId}/search?keyword=${encodeURIComponent(keyword)}&take=30`,
      { headers: buildAuthHeaders() },
    );

    const json = await parseJson<ApiResponse<MessageSearchResult>>(response);
    return json.data;
  }

  async searchAllMessages(keyword: string, skip = 0, take = 20): Promise<GlobalMessageSearchResult> {
    const response = await fetch(
      `${API_BASE}/search?keyword=${encodeURIComponent(keyword.trim())}&skip=${Math.max(skip, 0)}&take=${Math.max(take, 1)}`,
      { headers: buildAuthHeaders() },
    );

    const json = await parseJson<ApiResponse<GlobalMessageSearchResult>>(response);
    return json.data;
  }

  async updateConversationSettings(
    conversationId: number,
    payload: UpdateConversationSettingsPayload,
  ): Promise<MessageConversationSummary> {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/settings`, {
      method: 'PUT',
      headers: buildAuthHeaders(true),
      body: JSON.stringify(payload),
    });

    const json = await parseJson<ApiResponse<MessageConversationSummary>>(response);
    return json.data;
  }

  async markConversationRead(conversationId: number, lastReadMessageId?: number | null): Promise<void> {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({ lastReadMessageId: lastReadMessageId ?? null }),
    });

    await parseJson<ApiResponse<null>>(response);
  }

  async sendMessage(
    conversationId: number,
    payload: { text?: string; image?: File | null; replyToMessageId?: number | null },
  ): Promise<MessageItem> {
    const token = getAuthToken();
    const formData = new FormData();
    if (payload.text?.trim()) {
      formData.append('text', payload.text.trim());
    }
    if (payload.image) {
      const preparedImage = await maybeCompressImage(payload.image);
      formData.append('image', preparedImage);
    }
    if (payload.replyToMessageId) {
      formData.append('replyToMessageId', String(payload.replyToMessageId));
    }

    const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const json = await parseJson<ApiResponse<MessageItem>>(response);
    return json.data;
  }

  async recallMessage(messageId: number): Promise<MessageItem> {
    const response = await fetch(`${API_BASE}/messages/${messageId}/recall`, {
      method: 'POST',
      headers: buildAuthHeaders(),
    });

    const json = await parseJson<ApiResponse<MessageItem>>(response);
    return json.data;
  }

  async heartbeat(): Promise<void> {
    const response = await fetch(`${API_BASE}/presence/heartbeat`, {
      method: 'POST',
      headers: buildAuthHeaders(),
    });

    await parseJson<ApiResponse<null>>(response);
  }

  createHubConnection(): signalR.HubConnection {
    return new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => getAuthToken() ?? '',
      })
      .withAutomaticReconnect()
      .build();
  }
}

export const messageService = new MessageService();
