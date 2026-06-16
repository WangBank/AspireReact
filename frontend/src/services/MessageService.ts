import * as signalR from '@microsoft/signalr';
import { getAuthToken } from '../utils/authToken';

const API_BASE = '/api/messages';
const HUB_URL = '/messagehub';
const DefaultRequestTimeoutMs = 12000;
const UploadRequestTimeoutMs = 45000;
const DownloadRequestTimeoutMs = 45000;

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
  friendRequestId: number | null;
  friendRequestStatus: MessageFriendRequestStatus | null;
  friendRequestDirection: MessageFriendRequestDirection | null;
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

export type MessageFriendRequestStatus = 'pending' | 'accepted' | 'rejected';
export type MessageFriendRequestDirection = 'incoming' | 'outgoing';

export interface MessageFriendRequest {
  id: number;
  peer: MessageUserSummary;
  direction: MessageFriendRequestDirection;
  status: MessageFriendRequestStatus;
  requestMessage: string | null;
  requesterAlias: string | null;
  source: string;
  createdAt: string;
  respondedAt: string | null;
  canAccept: boolean;
  canReject: boolean;
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
  fileName: string | null;
  fileContentType: string | null;
  fileSizeBytes: number | null;
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
  fileName: string | null;
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

export interface CreateFriendRequestPayload {
  targetUserId: number;
  requestMessage?: string;
  alias?: string;
}

export interface RespondFriendRequestPayload {
  action: 'accept' | 'reject';
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
const ImageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

const buildAuthHeaders = (contentType = false): HeadersInit => {
  const token = getAuthToken();
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMessage = '请求超时，请稍后重试',
  timeoutMs = DefaultRequestTimeoutMs,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};

const requestJson = async <T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMessage = '请求超时，请稍后重试',
  timeoutMs = DefaultRequestTimeoutMs,
): Promise<T> => {
  const response = await fetchWithTimeout(input, init, timeoutMessage, timeoutMs);
  const json = await parseJson<ApiResponse<T>>(response);
  return json.data;
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

const isImageLikeFile = (file: File): boolean => {
  if (file.type.startsWith('image/')) {
    return true;
  }

  const extension = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  return ImageExtensions.has(extension);
};

const resolveDownloadFileName = (response: Response, fallback: string): string => {
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] ?? fallback;
};

export class MessageService {
  async searchUsers(keyword = '', skip = 0, take = 20): Promise<MessageUserSummary[]> {
    const normalizedKeyword = keyword.trim();
    const query = normalizedKeyword
      ? `?keyword=${encodeURIComponent(normalizedKeyword)}&skip=${Math.max(skip, 0)}&take=${Math.max(take, 1)}`
      : `?skip=${Math.max(skip, 0)}&take=${Math.max(take, 1)}`;

    return requestJson<MessageUserSummary[]>(
      `${API_BASE}/users${query}`,
      {
        headers: buildAuthHeaders(),
      },
      '搜索用户超时，请稍后重试',
    );
  }

  async getContacts(keyword = ''): Promise<MessageContact[]> {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
    return requestJson<MessageContact[]>(
      `${API_BASE}/contacts${query}`,
      {
        headers: buildAuthHeaders(),
      },
      '加载联系人超时，请稍后重试',
    );
  }

  async getFriendRequests(): Promise<MessageFriendRequest[]> {
    return requestJson<MessageFriendRequest[]>(
      `${API_BASE}/friend-requests`,
      {
        headers: buildAuthHeaders(),
      },
      '加载好友通知超时，请稍后重试',
    );
  }

  async createFriendRequest(payload: CreateFriendRequestPayload): Promise<MessageFriendRequest> {
    return requestJson<MessageFriendRequest>(
      `${API_BASE}/friend-requests`,
      {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          targetUserId: payload.targetUserId,
          requestMessage: payload.requestMessage?.trim() || null,
          alias: payload.alias?.trim() || null,
        }),
      },
      '发送好友申请超时，请稍后重试',
    );
  }

  async respondFriendRequest(requestId: number, payload: RespondFriendRequestPayload): Promise<MessageFriendRequest> {
    return requestJson<MessageFriendRequest>(
      `${API_BASE}/friend-requests/${requestId}/respond`,
      {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify(payload),
      },
      '处理好友申请超时，请稍后重试',
    );
  }

  async upsertContact(payload: UpsertContactPayload): Promise<MessageContact> {
    return requestJson<MessageContact>(
      `${API_BASE}/contacts`,
      {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          contactUserId: payload.contactUserId,
          alias: payload.alias ?? null,
          isPinned: payload.isPinned ?? false,
        }),
      },
      '保存联系人超时，请稍后重试',
    );
  }

  async updateContact(contactUserId: number, payload: UpdateContactPayload): Promise<MessageContact> {
    return requestJson<MessageContact>(
      `${API_BASE}/contacts/${contactUserId}`,
      {
        method: 'PUT',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          alias: payload.alias ?? null,
          isPinned: payload.isPinned ?? false,
        }),
      },
      '更新联系人超时，请稍后重试',
    );
  }

  async deleteContact(contactUserId: number): Promise<void> {
    await requestJson<null>(
      `${API_BASE}/contacts/${contactUserId}`,
      {
        method: 'DELETE',
        headers: buildAuthHeaders(),
      },
      '删除联系人超时，请稍后重试',
    );
  }

  async createOrGetDirectConversation(targetUserId: number): Promise<MessageConversationSummary> {
    return requestJson<MessageConversationSummary>(
      `${API_BASE}/conversations/direct`,
      {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ targetUserId }),
      },
      '发起会话超时，请稍后重试',
    );
  }

  async getConversations(keyword = ''): Promise<MessageConversationSummary[]> {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
    return requestJson<MessageConversationSummary[]>(
      `${API_BASE}/conversations${query}`,
      {
        headers: buildAuthHeaders(),
      },
      '加载会话超时，请稍后重试',
    );
  }

  async getConversation(conversationId: number, beforeMessageId?: number | null): Promise<MessageConversationDetail> {
    const query = beforeMessageId ? `?beforeMessageId=${beforeMessageId}&take=50` : '?take=50';
    return requestJson<MessageConversationDetail>(
      `${API_BASE}/conversations/${conversationId}${query}`,
      {
        headers: buildAuthHeaders(),
      },
      '加载会话详情超时，请稍后重试',
    );
  }

  async searchConversationMessages(conversationId: number, keyword: string): Promise<MessageSearchResult> {
    return requestJson<MessageSearchResult>(
      `${API_BASE}/conversations/${conversationId}/search?keyword=${encodeURIComponent(keyword)}&take=30`,
      { headers: buildAuthHeaders() },
      '搜索消息超时，请稍后重试',
    );
  }

  async searchAllMessages(keyword: string, skip = 0, take = 20): Promise<GlobalMessageSearchResult> {
    return requestJson<GlobalMessageSearchResult>(
      `${API_BASE}/search?keyword=${encodeURIComponent(keyword.trim())}&skip=${Math.max(skip, 0)}&take=${Math.max(take, 1)}`,
      { headers: buildAuthHeaders() },
      '全局搜索消息超时，请稍后重试',
    );
  }

  async updateConversationSettings(
    conversationId: number,
    payload: UpdateConversationSettingsPayload,
  ): Promise<MessageConversationSummary> {
    return requestJson<MessageConversationSummary>(
      `${API_BASE}/conversations/${conversationId}/settings`,
      {
        method: 'PUT',
        headers: buildAuthHeaders(true),
        body: JSON.stringify(payload),
      },
      '更新会话设置超时，请稍后重试',
    );
  }

  async markConversationRead(conversationId: number, lastReadMessageId?: number | null): Promise<void> {
    await requestJson<null>(
      `${API_BASE}/conversations/${conversationId}/read`,
      {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ lastReadMessageId: lastReadMessageId ?? null }),
      },
      '同步已读状态超时，请稍后重试',
    );
  }

  async sendMessage(
    conversationId: number,
    payload: { text?: string; attachment?: File | null; replyToMessageId?: number | null },
  ): Promise<MessageItem> {
    const token = getAuthToken();
    const formData = new FormData();
    if (payload.text?.trim()) {
      formData.append('text', payload.text.trim());
    }
    if (payload.attachment) {
      if (isImageLikeFile(payload.attachment)) {
        const preparedImage = await maybeCompressImage(payload.attachment);
        formData.append('image', preparedImage);
      } else {
        formData.append('file', payload.attachment);
      }
    }
    if (payload.replyToMessageId) {
      formData.append('replyToMessageId', String(payload.replyToMessageId));
    }

    return requestJson<MessageItem>(
      `${API_BASE}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      },
      '发送消息超时，请稍后重试',
      UploadRequestTimeoutMs,
    );
  }

  async downloadMessageFile(messageId: number, preferredFileName: string): Promise<void> {
    const response = await fetchWithTimeout(
      `${API_BASE}/messages/${messageId}/file`,
      {
        headers: buildAuthHeaders(),
      },
      '文件下载超时，请稍后重试',
      DownloadRequestTimeoutMs,
    );

    if (!response.ok) {
      let message = '文件下载失败';
      try {
        const json = await response.json();
        message = json.message || message;
      } catch {
        // ignore json parse failure
      }

      throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = resolveDownloadFileName(response, preferredFileName);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async recallMessage(messageId: number): Promise<MessageItem> {
    return requestJson<MessageItem>(
      `${API_BASE}/messages/${messageId}/recall`,
      {
        method: 'POST',
        headers: buildAuthHeaders(),
      },
      '撤回消息超时，请稍后重试',
    );
  }

  async heartbeat(): Promise<void> {
    await requestJson<null>(
      `${API_BASE}/presence/heartbeat`,
      {
        method: 'POST',
        headers: buildAuthHeaders(),
      },
      '在线状态同步超时，请稍后重试',
      8000,
    );
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
