import { observer } from 'mobx-react-lite';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import GifBoxRoundedIcon from '@mui/icons-material/GifBoxRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SentimentSatisfiedAltRoundedIcon from '@mui/icons-material/SentimentSatisfiedAltRounded';
import ScreenshotMonitorRoundedIcon from '@mui/icons-material/ScreenshotMonitorRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import MessageContactEditorDialog from '../components/Message/MessageContactEditorDialog';
import MessageDeleteContactDialog from '../components/Message/MessageDeleteContactDialog';
import { formatLastSeen, formatTime } from '../components/Message/messageFormatters';
import RouteLoadingFallback from '../components/Page/RouteLoadingFallback';
import type { MessageUserSummary } from '../services/MessageService';
import { useStore } from '../stores/StoreProvider';

type EmojiPanelTab = 'emoji' | 'favorite' | 'gif';

const RECENT_EMOJI_LIMIT = 22;
const INITIAL_RECENT_EMOJIS = [
  '🦁', '😭', '🥹', '👍', '🔪', '🥺', '🥵', '🤩', '🙄', '😳', '🤣',
  '🤭', '😊', '😎', '😰', '😥', '🥰', '😘', '😇', '🤔', '🙏', '🎉',
];
const SUPER_EMOJIS = [
  '😭', '🤣', '😊', '😎', '🦁', '🥺', '🥰', '🥳', '😚', '😱', '🤯',
  '🤭', '😘', '👋', '🤖', '🧀', '🥹', '😋', '🙏', '🤔', '🌞', '🌙',
  '🥮', '🥲', '🫂', '🤡', '🏀', '📸', '🎂', '🎀', '🎆', '📍', '🥷',
  '🐉', '🥸', '🫣', '🌹', '🚃', '🐤', '😄', '😁', '😆', '🙂', '😉',
  '😌', '😍', '😗', '😜', '🤪', '😝', '😏', '🙃', '😮', '😤', '😴',
  '🤤', '😵', '🥶', '😈', '👻', '💀', '💪', '👌', '✌️', '🤞', '👏',
  '🙌', '🫶', '💖', '💝', '🎈', '🎁', '🍓', '🍉', '🍔', '☕', '🌈',
  '⭐', '⚡', '🎵', '🎮', '🐶', '🐱', '🦊', '🐻', '🐼', '🐸',
];
const FAVORITE_EMOJIS = [
  '❤️', '🔥', '👍', '👏', '🥳', '🎉', '🙏', '😊', '😎', '🥹', '🌹', '✨',
  '🫶', '💖', '😘', '🥰', '😍', '🤝', '👌', '🎈', '🎁', '🌈', '⭐', '☕',
];
const EMOJI_GRID_COLUMNS = {
  xs: 'repeat(6, minmax(0, 1fr))',
  sm: 'repeat(11, minmax(0, 1fr))',
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) {
    return '未知大小';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const isPreviewableImage = (file: File | null) => Boolean(file && file.type.startsWith('image/'));

const describeMessageContent = (message: {
  isRecalled?: boolean;
  textContent?: string | null;
  fileName?: string | null;
  imageFileName?: string | null;
}) => {
  if (message.isRecalled) {
    return '原消息已撤回';
  }

  if (message.textContent?.trim()) {
    return message.textContent;
  }

  if (message.fileName) {
    return `[文件] ${message.fileName}`;
  }

  if (message.imageFileName) {
    return `[图片] ${message.imageFileName}`;
  }

  return '[附件消息]';
};

const formatFriendRequestNoticeTime = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

const MessagePage = observer(() => {
  const { authStore, messageStore } = useStore();
  const theme = useTheme();
  const navigate = useNavigate();
  const [conversationKeyword, setConversationKeyword] = useState('');
  const [messageKeyword, setMessageKeyword] = useState('');
  const [globalMessageKeyword, setGlobalMessageKeyword] = useState('');
  const [composerText, setComposerText] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [selectedAttachmentPreviewUrl, setSelectedAttachmentPreviewUrl] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactSearchKeyword, setContactSearchKeyword] = useState('');
  const [friendRequestMessage, setFriendRequestMessage] = useState('');
  const [contactAlias, setContactAlias] = useState('');
  const [selectedContactUserId, setSelectedContactUserId] = useState<number | null>(null);
  const [selectedContactPreview, setSelectedContactPreview] = useState<MessageUserSummary | null>(null);
  const [contactPinned, setContactPinned] = useState(false);
  const [editingContactUserId, setEditingContactUserId] = useState<number | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [deleteContactTarget, setDeleteContactTarget] = useState<{ userId: number; label: string } | null>(null);
  const [contactDeleting, setContactDeleting] = useState(false);
  const [contactSearchSkip, setContactSearchSkip] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [showConversationSearch, setShowConversationSearch] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [emojiPanelTab, setEmojiPanelTab] = useState<EmojiPanelTab>('emoji');
  const [recentEmojis, setRecentEmojis] = useState(INITIAL_RECENT_EMOJIS);
  const [friendRequestAnchorEl, setFriendRequestAnchorEl] = useState<HTMLElement | null>(null);
  const [conversationActionsAnchorEl, setConversationActionsAnchorEl] = useState<HTMLElement | null>(null);
  const [composerNotice, setComposerNotice] = useState<{
    severity: 'error' | 'info' | 'success';
    text: string;
  } | null>(null);

  useEffect(() => {
    messageStore.setMessagePageActive(true);
    void messageStore.initialize();
    return () => {
      messageStore.setMessagePageActive(false);
    };
  }, [messageStore]);

  useEffect(() => {
    if (!selectedAttachment || !isPreviewableImage(selectedAttachment)) {
      setSelectedAttachmentPreviewUrl(null);
      return undefined;
    }

    const nextUrl = URL.createObjectURL(selectedAttachment);
    setSelectedAttachmentPreviewUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [selectedAttachment]);

  useEffect(() => {
    if (!messageStore.highlightedMessageId) {
      return undefined;
    }

    const element = document.querySelector<HTMLElement>(`[data-message-id="${messageStore.highlightedMessageId}"]`);
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    const timer = window.setTimeout(() => {
      messageStore.highlightMessage(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [messageStore, messageStore.highlightedMessageId]);

  const unreadCount = useMemo(
    () => messageStore.conversations.reduce((total, item) => total + item.unreadCount, 0),
    [messageStore.conversations],
  );
  const currentSummary = messageStore.currentConversation?.summary ?? null;
  const currentPeerContact = useMemo(
    () => (
      currentSummary
        ? messageStore.contacts.find((item) => item.contactUserId === currentSummary.peer.id) ?? null
        : null
    ),
    [currentSummary, messageStore.contacts],
  );
  const replyTarget = useMemo(
    () => messageStore.currentConversation?.messages.find((item) => item.id === replyTargetId) ?? null,
    [messageStore.currentConversation?.messages, replyTargetId],
  );
  const currentCanSend = currentSummary?.peer.isFriend ?? false;
  const currentPeerLabel = currentSummary?.peer.alias || currentSummary?.peer.username || '';
  const defaultFriendRequestMessage = useMemo(
    () => authStore.username ? `我是${authStore.username}` : '你好，我想加你为好友',
    [authStore.username],
  );
  const selectedIncomingFriendRequestId = selectedContactPreview?.friendRequestStatus === 'pending'
    && selectedContactPreview.friendRequestDirection === 'incoming'
    ? selectedContactPreview.friendRequestId
    : null;
  const selectedOutgoingFriendRequestPending = selectedContactPreview?.friendRequestStatus === 'pending'
    && selectedContactPreview.friendRequestDirection === 'outgoing';
  const pendingIncomingFriendRequests = useMemo(
    () => [...messageStore.friendRequests]
      .filter((item) => item.direction === 'incoming' && item.status === 'pending')
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [messageStore.friendRequests],
  );
  const canSubmitMessage = currentCanSend
    && !messageStore.sending
    && (composerText.trim().length > 0 || Boolean(selectedAttachment));

  useEffect(() => {
    if (!currentSummary) {
      setShowConversationSearch(false);
      setConversationActionsAnchorEl(null);
    }
  }, [currentSummary]);

  const handleSearchUsers = async () => {
    setContactSearchSkip(0);
    await messageStore.searchUsers(contactSearchKeyword, 0);
  };

  const handleNextContactBatch = async () => {
    const nextSkip = contactSearchSkip + 20;
    await messageStore.searchUsers(contactSearchKeyword, nextSkip);
    const availableUsers = messageStore.userSearchResults.filter((item) => !item.isContact);
    if (availableUsers.length === 0) {
      setContactSearchSkip(0);
      await messageStore.searchUsers(contactSearchKeyword, 0);
      return;
    }

    setContactSearchSkip(nextSkip);
  };

  const resetContactDialog = () => {
    setSelectedContactUserId(null);
    setSelectedContactPreview(null);
    setFriendRequestMessage(defaultFriendRequestMessage);
    setContactAlias('');
    setContactPinned(false);
    setEditingContactUserId(null);
    setContactSearchKeyword('');
    setContactSearchSkip(0);
    messageStore.clearUserSearchResults();
  };

  const openCreateContactDialog = async () => {
    resetContactDialog();
    setContactDialogOpen(true);
    await messageStore.searchUsers('', 0);
  };

  const openEditContactDialog = (contactUserId: number) => {
    const contact = messageStore.contacts.find((item) => item.contactUserId === contactUserId);
    if (!contact) {
      return;
    }

    setSelectedContactUserId(contactUserId);
    setContactAlias(contact.alias ?? '');
    setContactPinned(contact.isPinned);
    setEditingContactUserId(contactUserId);
    setContactDialogOpen(true);
  };

  const openCreateContactDialogForUser = (user: MessageUserSummary) => {
    resetContactDialog();
    setSelectedContactUserId(user.id);
    setSelectedContactPreview(user);
    setContactAlias(user.alias ?? user.username);
    setContactDialogOpen(true);
  };

  const saveContact = async () => {
    if (!selectedContactUserId) {
      return;
    }

    setContactSaving(true);
    try {
      if (editingContactUserId) {
        await messageStore.updateContact(selectedContactUserId, contactAlias, contactPinned);
      } else if (selectedIncomingFriendRequestId) {
        await messageStore.respondFriendRequest(selectedIncomingFriendRequestId, 'accept');
      } else if (!selectedOutgoingFriendRequestPending) {
        await messageStore.createFriendRequest(selectedContactUserId, friendRequestMessage, contactAlias);
      } else {
        return;
      }

      setContactDialogOpen(false);
      resetContactDialog();
    } finally {
      setContactSaving(false);
    }
  };

  const sendMessage = async () => {
    if (!canSubmitMessage) {
      return;
    }

    const sent = await messageStore.sendMessage(composerText, selectedAttachment, replyTarget?.id);
    if (!sent) {
      return;
    }

    setComposerText('');
    setSelectedAttachment(null);
    setReplyTargetId(null);
    setComposerNotice(null);
  };

  const appendEmoji = (emoji: string) => {
    setComposerText((value) => `${value}${emoji}`);
    setRecentEmojis((current) => [emoji, ...current.filter((item) => item !== emoji)].slice(0, RECENT_EMOJI_LIMIT));
    setEmojiAnchorEl(null);
    setEmojiPanelTab('emoji');
  };

  const readClipboardScreenshot = async () => {
    if (!navigator.clipboard?.read) {
      setComposerNotice({
        severity: 'info',
        text: '当前环境不支持直接读取剪贴板截图，请使用图片按钮选择文件。',
      });
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const imageItem = clipboardItems.find((item) => item.types.some((type) => type.startsWith('image/')));

      if (!imageItem) {
        setComposerNotice({
          severity: 'info',
          text: '剪贴板里没有图片，请先截图并复制后再试。',
        });
        return;
      }

      const mimeType = imageItem.types.find((type) => type.startsWith('image/')) ?? 'image/png';
      const blob = await imageItem.getType(mimeType);
      const extension = mimeType.split('/')[1] || 'png';
      const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type: mimeType });

      setSelectedAttachment(file);
      setComposerNotice({
        severity: 'success',
        text: '已从剪贴板读取截图，可直接发送。',
      });
    } catch {
      setComposerNotice({
        severity: 'error',
        text: '读取截图失败，请确认浏览器已授权剪贴板访问。',
      });
    }
  };

  const handleAttachmentPicked = (file: File | null) => {
    setSelectedAttachment(file);
    if (file) {
      setComposerNotice(null);
    }
  };

  const openGlobalSearchHit = async (conversationId: number, messageId: number) => {
    setGlobalSearchOpen(false);
    await messageStore.focusMessage(conversationId, messageId);
  };

  const openFriendRequestMenu = (event: MouseEvent<HTMLElement>) => {
    setFriendRequestAnchorEl(event.currentTarget);
    if (!messageStore.friendRequests.length && !messageStore.friendRequestsLoading) {
      void messageStore.loadFriendRequests();
    }
  };

  const closeFriendRequestMenu = () => {
    setFriendRequestAnchorEl(null);
  };

  const navigateToFriendRequest = (requestId: number, peerUserId: number) => {
    closeFriendRequestMenu();
    navigate('/messages/contacts', {
      state: {
        friendRequestId: requestId,
        peerUserId,
        focusSection: 'friendRequests',
      },
    });
  };

  const confirmDeleteContact = (userId: number, label: string) => {
    setDeleteContactTarget({ userId, label });
  };

  const handleDeleteContact = async () => {
    if (!deleteContactTarget) {
      return;
    }

    setContactDeleting(true);
    try {
      await messageStore.deleteContact(deleteContactTarget.userId);
      setDeleteContactTarget(null);
      setConversationActionsAnchorEl(null);
    } finally {
      setContactDeleting(false);
    }
  };

  const toggleConversationPinned = async () => {
    if (!currentSummary) {
      return;
    }

    await messageStore.updateConversationSettings(
      currentSummary.conversationId,
      !currentSummary.isPinned,
      currentSummary.isMuted,
    );
  };

  const toggleConversationMuted = async () => {
    if (!currentSummary) {
      return;
    }

    await messageStore.updateConversationSettings(
      currentSummary.conversationId,
      currentSummary.isPinned,
      !currentSummary.isMuted,
    );
  };

  const refreshWorkspace = () => {
    void messageStore.loadConversations(conversationKeyword);
    void messageStore.loadContacts();
  };

  if (messageStore.loading && messageStore.conversations.length === 0 && messageStore.contacts.length === 0) {
    return <RouteLoadingFallback label="消息模块加载中..." minHeight={320} compact />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {messageStore.error && !currentSummary && (
        <Alert severity="error" onClose={messageStore.clearError}>
          {messageStore.error}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '320px minmax(0, 1fr)' },
          minHeight: { md: 760 },
          overflow: 'hidden',
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRight: { md: `1px solid ${theme.palette.divider}` },
          }}
        >
          <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    聊天
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {messageStore.conversations.length} 个会话，未读 {unreadCount}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <Badge
                    color="error"
                    badgeContent={pendingIncomingFriendRequests.length > 99 ? '99+' : pendingIncomingFriendRequests.length}
                    invisible={pendingIncomingFriendRequests.length === 0}
                  >
                    <IconButton onClick={openFriendRequestMenu} size="small">
                      <NotificationsRoundedIcon fontSize="small" />
                    </IconButton>
                  </Badge>
                  <IconButton onClick={() => navigate('/messages/contacts')} size="small">
                    <GroupRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={() => void openCreateContactDialog()} size="small">
                    <PersonAddAlt1RoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={refreshWorkspace} size="small">
                    <RefreshRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={() => setGlobalSearchOpen(true)} size="small">
                    <ManageSearchRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="搜索会话"
                  value={conversationKeyword}
                  onChange={(event) => setConversationKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void messageStore.loadConversations(conversationKeyword);
                    }
                  }}
                />
                <IconButton onClick={() => void messageStore.loadConversations(conversationKeyword)}>
                  <SearchRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {messageStore.conversations.length === 0 ? (
              <Box sx={{ p: 2.5 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无会话。先添加联系人，双方互相添加后才能开始聊天。
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {messageStore.conversations.map((conversation, index) => (
                  <Box key={conversation.conversationId}>
                    <ListItemButton
                      selected={messageStore.selectedConversationId === conversation.conversationId}
                      onClick={() => void messageStore.selectConversation(conversation.conversationId)}
                      sx={{ px: 2, py: 1.25, alignItems: 'flex-start' }}
                    >
                      <Badge
                        color="error"
                        overlap="circular"
                        badgeContent={conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        invisible={conversation.unreadCount === 0}
                      >
                        <Avatar
                          src={conversation.peer.avatarUrl ?? undefined}
                          alt={conversation.peer.username}
                          sx={{ width: 42, height: 42, mr: 1.25 }}
                        >
                          {conversation.peer.username.slice(0, 1).toUpperCase()}
                        </Avatar>
                      </Badge>

                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 700, flex: 1 }}>
                            {conversation.peer.alias || conversation.peer.username}
                          </Typography>
                          {conversation.isPinned && <PushPinRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
                          {conversation.isMuted && <VolumeOffRoundedIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {conversation.lastMessagePreview || '还没有消息'}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.25 }}>
                          {conversation.peer.isOnline && (
                            <CircleRoundedIcon sx={{ fontSize: 12, color: 'success.main' }} />
                          )}
                          {!conversation.peer.isFriend && (
                            <Typography variant="caption" color="warning.main">
                              待互加
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {conversation.lastMessageAt
                              ? formatTime(conversation.lastMessageAt)
                              : formatLastSeen(conversation.peer.isOnline, conversation.peer.lastSeenAt)}
                          </Typography>
                        </Stack>
                      </Box>
                    </ListItemButton>
                    {index < messageStore.conversations.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: { md: 760 } }}>
          {currentSummary ? (
            <>
              <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Avatar
                        src={currentSummary.peer.avatarUrl ?? undefined}
                        alt={currentSummary.peer.username}
                        sx={{ width: 48, height: 48 }}
                      >
                        {currentSummary.peer.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                            {currentPeerLabel}
                          </Typography>
                          {currentSummary.peer.isOnline && (
                            <CircleRoundedIcon sx={{ fontSize: 13, color: 'success.main' }} />
                          )}
                          {!currentCanSend && (
                            <Chip
                              size="small"
                              color="warning"
                              icon={<LockRoundedIcon />}
                              label="未互为好友"
                            />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {currentCanSend
                            ? formatLastSeen(currentSummary.peer.isOnline, currentSummary.peer.lastSeenAt)
                            : '待双方互相添加后才能继续发送消息'}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant={showConversationSearch ? 'contained' : 'outlined'}
                        startIcon={<SearchRoundedIcon />}
                        onClick={() => setShowConversationSearch((value) => !value)}
                      >
                        搜索
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        component="label"
                        disabled={!currentCanSend}
                        startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}
                      >
                        图片
                        <input
                          hidden
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                          onChange={(event) => handleAttachmentPicked(event.target.files?.[0] ?? null)}
                        />
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        component="label"
                        disabled={!currentCanSend}
                        startIcon={<AttachFileRoundedIcon fontSize="small" />}
                      >
                        文件
                        <input
                          hidden
                          type="file"
                          accept=".pdf,.txt,.md,.csv,.tsv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.rtf"
                          onChange={(event) => handleAttachmentPicked(event.target.files?.[0] ?? null)}
                        />
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => navigate('/messages/contacts')}>
                        联系人
                      </Button>
                      <IconButton onClick={(event) => setConversationActionsAnchorEl(event.currentTarget)} size="small">
                        <MoreHorizRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {!currentCanSend && (
                    <Alert
                      severity="warning"
                      action={currentPeerContact ? (
                        <Button color="inherit" size="small" onClick={() => openEditContactDialog(currentPeerContact.contactUserId)}>
                          联系人设置
                        </Button>
                      ) : (
                        <Button color="inherit" size="small" onClick={() => openCreateContactDialogForUser(currentSummary.peer)}>
                          添加联系人
                        </Button>
                      )}
                    >
                      {currentPeerContact
                        ? '你已经添加了对方，但对方还没有把你加为联系人。'
                        : '你还没有添加对方为联系人。添加后仍需对方也添加你。'}
                    </Alert>
                  )}

                  {showConversationSearch && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="搜索当前会话历史"
                        value={messageKeyword}
                        onChange={(event) => setMessageKeyword(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            void messageStore.searchMessages(messageKeyword);
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => void messageStore.searchMessages(messageKeyword)}
                        disabled={messageStore.searchingMessages || !messageKeyword.trim()}
                      >
                        {messageStore.searchingMessages ? '搜索中...' : '搜索'}
                      </Button>
                      {messageStore.messageSearchResult && (
                        <Button onClick={messageStore.clearMessageSearch}>
                          清空
                        </Button>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Box>

              {messageStore.messageSearchResult && (
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    搜索结果 {messageStore.messageSearchResult.total} 条
                  </Typography>
                  <Stack spacing={1} sx={{ maxHeight: 180, overflowY: 'auto' }}>
                    {messageStore.messageSearchResult.messages.map((message) => (
                      <Paper
                        key={message.id}
                        variant="outlined"
                        sx={{ p: 1.25, cursor: 'pointer' }}
                        onClick={() => void messageStore.focusMessage(message.conversationId, message.id)}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {message.senderUsername} · {formatTime(message.createdAt)}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {message.isRecalled ? '这条消息已撤回' : describeMessageContent(message)}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              <Box sx={{ flex: 1, overflowY: 'auto', p: 2, backgroundColor: theme.palette.background.default }}>
                <Stack spacing={1.5}>
                  {messageStore.currentConversation?.hasMore && (
                    <Box sx={{ textAlign: 'center' }}>
                      <Button onClick={() => void messageStore.loadOlderMessages()} disabled={messageStore.messagesLoading}>
                        {messageStore.messagesLoading ? '加载中...' : '加载更早消息'}
                      </Button>
                    </Box>
                  )}

                  {messageStore.currentConversation?.messages.map((message, index, messages) => {
                    const previousMessage = messages[index - 1];
                    const showTimeDivider = index === 0
                      || !previousMessage
                      || Math.abs(new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime()) >= 10 * 60 * 1000;

                    return (
                      <Stack key={message.id} spacing={0.5}>
                        {showTimeDivider && (
                          <Box sx={{ textAlign: 'center', py: 0.25 }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(message.createdAt)}
                            </Typography>
                          </Box>
                        )}

                        <Stack
                          data-message-id={message.id}
                          direction="row"
                          spacing={1}
                          sx={{
                            justifyContent: message.isMine ? 'flex-end' : 'flex-start',
                            alignItems: 'flex-end',
                            backgroundColor: messageStore.highlightedMessageId === message.id
                              ? alpha(theme.palette.warning.main, 0.12)
                              : 'transparent',
                            borderRadius: 2,
                            p: 0.25,
                          }}
                        >
                          {!message.isMine && (
                            <Avatar src={message.senderAvatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                              {message.senderUsername.slice(0, 1).toUpperCase()}
                            </Avatar>
                          )}

                          <Stack
                            spacing={0.5}
                            sx={{
                              maxWidth: { xs: '88%', md: '72%' },
                              alignItems: message.isMine ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {message.isMine ? '我' : message.senderUsername}
                            </Typography>

                            <Paper
                              variant="outlined"
                              sx={{
                                px: 1.25,
                                py: 1,
                                borderRadius: 2,
                                backgroundColor: message.isMine
                                  ? alpha(theme.palette.primary.main, 0.1)
                                  : theme.palette.background.paper,
                              }}
                            >
                              {message.replyToMessage && (
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    mb: 0.8,
                                    px: 1,
                                    py: 0.75,
                                    borderRadius: 1.5,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                  }}
                                >
                                  <Typography variant="caption" color="text.secondary">
                                    回复 {message.replyToMessage.senderUsername}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 0.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {describeMessageContent(message.replyToMessage)}
                                  </Typography>
                                </Paper>
                              )}

                              {message.isRecalled ? (
                                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                  {message.isMine ? '你撤回了一条消息' : `${message.senderUsername} 撤回了一条消息`}
                                </Typography>
                              ) : message.textContent ? (
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {message.textContent}
                                </Typography>
                              ) : null}

                              {message.imageUrl && !message.isRecalled && (
                                <Box sx={{ mt: message.textContent ? 1 : 0 }}>
                                  <Box
                                    component="img"
                                    src={message.imageUrl}
                                    alt={message.imageFileName || '消息图片'}
                                    sx={{
                                      display: 'block',
                                      maxWidth: '100%',
                                      borderRadius: 1.5,
                                      cursor: 'zoom-in',
                                      border: `1px solid ${theme.palette.divider}`,
                                    }}
                                    onClick={() => setPreviewImage({
                                      url: message.imageUrl ?? '',
                                      label: message.imageFileName || '消息图片',
                                    })}
                                  />
                                </Box>
                              )}

                              {message.fileName && !message.isRecalled && (
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    mt: message.textContent || message.imageUrl ? 1 : 0,
                                    px: 1,
                                    py: 0.85,
                                    borderRadius: 1.5,
                                  }}
                                >
                                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Stack direction="row" spacing={0.85} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
                                      <AttachFileRoundedIcon sx={{ fontSize: 18 }} />
                                      <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                                          {message.fileName}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {formatFileSize(message.fileSizeBytes)}
                                        </Typography>
                                      </Box>
                                    </Stack>
                                    <Button
                                      size="small"
                                      color="inherit"
                                      onClick={() => void messageStore.downloadMessageFile(message.id, message.fileName ?? 'message-file')}
                                    >
                                      下载
                                    </Button>
                                  </Stack>
                                </Paper>
                              )}
                            </Paper>

                            <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                              {!showTimeDivider && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatTime(message.createdAt)}
                                </Typography>
                              )}
                              {!message.isRecalled && currentCanSend && (
                                <IconButton size="small" onClick={() => setReplyTargetId(message.id)}>
                                  <ReplyRoundedIcon fontSize="inherit" />
                                </IconButton>
                              )}
                              {message.canRecall && (
                                <IconButton size="small" color="warning" onClick={() => void messageStore.recallMessage(message.id)}>
                                  <UndoRoundedIcon fontSize="inherit" />
                                </IconButton>
                              )}
                            </Stack>
                          </Stack>

                          {message.isMine && (
                            <Avatar src={authStore.avatarUrl ?? message.senderAvatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                              {(authStore.username ?? message.senderUsername).slice(0, 1).toUpperCase()}
                            </Avatar>
                          )}
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>

              <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Stack spacing={1.25}>
                  {replyTarget && currentCanSend && (
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            正在回复 {replyTarget.senderUsername}
                          </Typography>
                          <Typography variant="body2" noWrap>
                            {describeMessageContent(replyTarget)}
                          </Typography>
                        </Box>
                        <Button color="inherit" onClick={() => setReplyTargetId(null)}>
                          取消
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  {selectedAttachment && (
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.25}
                        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                      >
                        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                          {selectedAttachmentPreviewUrl ? (
                            <Box
                              component="img"
                              src={selectedAttachmentPreviewUrl}
                              alt={selectedAttachment.name}
                              sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 1.5,
                                objectFit: 'cover',
                                border: `1px solid ${theme.palette.divider}`,
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1px solid ${theme.palette.divider}`,
                              }}
                            >
                              <AttachFileRoundedIcon />
                            </Box>
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              {selectedAttachment.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatFileSize(selectedAttachment.size)}
                            </Typography>
                          </Box>
                        </Stack>
                        <Button color="inherit" onClick={() => setSelectedAttachment(null)}>
                          移除
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  {composerNotice && (
                    <Alert severity={composerNotice.severity} onClose={() => setComposerNotice(null)}>
                      {composerNotice.text}
                    </Alert>
                  )}

                  {messageStore.error && (
                    <Alert severity="error" onClose={messageStore.clearError}>
                      {messageStore.error}
                    </Alert>
                  )}

                  <Paper variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={1}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                      >
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                          <IconButton
                            size="small"
                            disabled={!currentCanSend}
                            onClick={(event) => {
                              setEmojiPanelTab('emoji');
                              setEmojiAnchorEl(event.currentTarget);
                            }}
                          >
                            <SentimentSatisfiedAltRoundedIcon fontSize="small" />
                          </IconButton>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ScreenshotMonitorRoundedIcon fontSize="small" />}
                            disabled={!currentCanSend}
                            onClick={() => void readClipboardScreenshot()}
                          >
                            截图
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            component="label"
                            disabled={!currentCanSend}
                            startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}
                          >
                            图片
                            <input
                              hidden
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                              onChange={(event) => handleAttachmentPicked(event.target.files?.[0] ?? null)}
                            />
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            component="label"
                            disabled={!currentCanSend}
                            startIcon={<AttachFileRoundedIcon fontSize="small" />}
                          >
                            文件
                            <input
                              hidden
                              type="file"
                              accept=".pdf,.txt,.md,.csv,.tsv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.rtf"
                              onChange={(event) => handleAttachmentPicked(event.target.files?.[0] ?? null)}
                            />
                          </Button>
                        </Stack>

                        <Button
                          variant="contained"
                          endIcon={<SendRoundedIcon />}
                          disabled={!canSubmitMessage}
                          onClick={() => void sendMessage()}
                        >
                          {messageStore.sending ? '发送中...' : '发送'}
                        </Button>
                      </Stack>

                      <TextField
                        multiline
                        minRows={3}
                        maxRows={6}
                        fullWidth
                        disabled={!currentCanSend}
                        placeholder={currentCanSend ? '输入消息，Enter 发送，Shift+Enter 换行' : '待双方互相添加后，才可继续发送消息'}
                        value={composerText}
                        onChange={(event) => setComposerText(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter'
                            && !event.shiftKey
                            && !(event.nativeEvent as KeyboardEvent).isComposing
                          ) {
                            event.preventDefault();
                            if (canSubmitMessage) {
                              void sendMessage();
                            }
                          }
                        }}
                      />
                    </Stack>
                  </Paper>
                </Stack>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
              }}
            >
              <Stack spacing={1.25} sx={{ maxWidth: 360, textAlign: 'center', alignItems: 'center' }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.light', color: 'primary.main' }}>
                  <ChatBubbleOutlineRoundedIcon />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  选择一个会话
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  从左侧进入会话，或者先添加联系人。双方互相添加后，系统才允许发送首条站内消息。
                </Typography>
                <Button variant="contained" startIcon={<PersonAddAlt1RoundedIcon />} onClick={() => void openCreateContactDialog()}>
                  添加联系人
                </Button>
              </Stack>
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>全局消息搜索</DialogTitle>
        <DialogContent sx={{ pt: 0.5 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="输入消息关键字或图片文件名"
                value={globalMessageKeyword}
                onChange={(event) => setGlobalMessageKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void messageStore.searchAllMessages(globalMessageKeyword);
                  }
                }}
              />
              <Button
                variant="contained"
                startIcon={<SearchRoundedIcon />}
                onClick={() => void messageStore.searchAllMessages(globalMessageKeyword)}
                disabled={messageStore.searchingMessages || !globalMessageKeyword.trim()}
              >
                {messageStore.searchingMessages ? '搜索中...' : '搜索'}
              </Button>
              {messageStore.globalMessageSearchResult && (
                <Button onClick={messageStore.clearGlobalMessageSearch}>
                  清空
                </Button>
              )}
            </Stack>

            {messageStore.globalMessageSearchResult && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  共找到 {messageStore.globalMessageSearchResult.total} 条消息，点击结果可直接定位到原消息。
                </Typography>
                <Stack spacing={1} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {messageStore.globalMessageSearchResult.hits.map((hit) => (
                    <Paper
                      key={`${hit.conversationId}-${hit.message.id}`}
                      variant="outlined"
                      sx={{ p: 1.25, cursor: 'pointer' }}
                      onClick={() => void openGlobalSearchHit(hit.conversationId, hit.message.id)}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {hit.peer.alias || hit.peer.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {hit.message.senderUsername} · {formatTime(hit.message.createdAt)}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {hit.message.isRecalled ? '这条消息已撤回' : describeMessageContent(hit.message)}
                      </Typography>
                    </Paper>
                  ))}
                  {messageStore.globalMessageSearchResult.hits.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      没有匹配到消息。
                    </Typography>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <Menu
        anchorEl={friendRequestAnchorEl}
        open={Boolean(friendRequestAnchorEl)}
        onClose={closeFriendRequestMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1.5, minWidth: 320 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            好友申请
          </Typography>
          <Typography variant="caption" color="text.secondary">
            点开后跳转到联系人页处理。
          </Typography>
        </Box>
        <Divider />
        {messageStore.friendRequestsLoading ? (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              好友申请加载中...
            </Typography>
          </Box>
        ) : pendingIncomingFriendRequests.length > 0 ? (
          pendingIncomingFriendRequests.slice(0, 6).map((request, index) => (
            <Box key={request.id}>
              <MenuItem onClick={() => navigateToFriendRequest(request.id, request.peer.id)} sx={{ alignItems: 'flex-start', py: 1.25 }}>
                <Stack direction="row" spacing={1.25} sx={{ width: '100%', alignItems: 'flex-start' }}>
                  <Avatar src={request.peer.avatarUrl ?? undefined} alt={request.peer.username} sx={{ width: 40, height: 40 }}>
                    {request.peer.username.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {request.peer.alias || request.peer.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFriendRequestNoticeTime(request.createdAt)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {request.requestMessage?.trim() || '请求添加你为好友'}
                    </Typography>
                  </Box>
                </Stack>
              </MenuItem>
              {index < pendingIncomingFriendRequests.slice(0, 6).length - 1 && <Divider />}
            </Box>
          ))
        ) : (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              目前没有待处理的好友申请。
            </Typography>
          </Box>
        )}
        <Divider />
        <Box sx={{ px: 1.5, py: 0.75, display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={() => {
            closeFriendRequestMenu();
            navigate('/messages/contacts');
          }}
          >
            查看全部
          </Button>
        </Box>
      </Menu>

      <Menu
        anchorEl={conversationActionsAnchorEl}
        open={Boolean(conversationActionsAnchorEl)}
        onClose={() => setConversationActionsAnchorEl(null)}
      >
        {currentPeerContact ? (
          <MenuItem
            onClick={() => {
              setConversationActionsAnchorEl(null);
              openEditContactDialog(currentPeerContact.contactUserId);
            }}
          >
            <EditRoundedIcon fontSize="small" sx={{ mr: 1 }} />
            编辑联系人
          </MenuItem>
        ) : currentSummary ? (
          <MenuItem
            onClick={() => {
              setConversationActionsAnchorEl(null);
              openCreateContactDialogForUser(currentSummary.peer);
            }}
          >
            <PersonAddAlt1RoundedIcon fontSize="small" sx={{ mr: 1 }} />
            添加联系人
          </MenuItem>
        ) : null}

        {currentPeerContact && (
          <MenuItem
            onClick={() => confirmDeleteContact(
              currentPeerContact.contactUserId,
              currentPeerContact.alias || currentPeerContact.username,
            )}
          >
            <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
            删除联系人
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            setConversationActionsAnchorEl(null);
            void toggleConversationPinned();
          }}
          disabled={!currentSummary}
        >
          <PushPinRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          {currentSummary?.isPinned ? '取消置顶' : '置顶会话'}
        </MenuItem>

        <MenuItem
          onClick={() => {
            setConversationActionsAnchorEl(null);
            void toggleConversationMuted();
          }}
          disabled={!currentSummary}
        >
          <VolumeOffRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          {currentSummary?.isMuted ? '取消静音' : '静音会话'}
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={emojiAnchorEl}
        open={Boolean(emojiAnchorEl)}
        onClose={() => setEmojiAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: -1,
              width: 744,
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: 3.5,
              overflow: 'hidden',
              backgroundColor: '#f9f6f4',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,246,244,1) 100%)',
              border: `1px solid ${alpha('#6e3a25', 0.06)}`,
              boxShadow: `0 24px 56px ${alpha('#7b4c39', 0.14)}`,
            },
          },
          list: {
            sx: {
              p: 0,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              px: { xs: 2, sm: 2.6 },
              pt: { xs: 1.9, sm: 2.4 },
              pb: 1.4,
              maxHeight: { xs: 420, sm: 540 },
              overflowY: 'auto',
            }}
          >
            {emojiPanelTab === 'emoji' && (
              <Stack spacing={2.5}>
                {[
                  { label: '最近表情', items: recentEmojis },
                  { label: '超级表情', items: SUPER_EMOJIS },
                ].map((section) => (
                  <Box key={section.label}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        mb: 1.35,
                        fontWeight: 800,
                        color: '#6a483d',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {section.label}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: { xs: 0.5, sm: 0.75 },
                        gridTemplateColumns: EMOJI_GRID_COLUMNS,
                        justifyItems: 'center',
                      }}
                    >
                      {section.items.map((emoji) => (
                        <Button
                          key={`${section.label}-${emoji}`}
                          onClick={() => appendEmoji(emoji)}
                          sx={{
                            minWidth: 0,
                            width: '100%',
                            height: { xs: 52, sm: 58 },
                            borderRadius: 2.4,
                            p: 0,
                            fontSize: { xs: '1.95rem', sm: '2.2rem' },
                            lineHeight: 1,
                            backgroundColor: 'transparent',
                            transition: 'background-color 160ms ease, transform 160ms ease',
                            '&:hover': {
                              backgroundColor: alpha('#fff', 0.72),
                              transform: 'translateY(-1px)',
                            },
                          }}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}

            {emojiPanelTab === 'favorite' && (
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    mb: 1.2,
                    fontWeight: 800,
                    color: '#6a483d',
                    letterSpacing: '-0.02em',
                  }}
                >
                  收藏表情
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: { xs: 0.5, sm: 0.75 },
                    gridTemplateColumns: EMOJI_GRID_COLUMNS,
                    justifyItems: 'center',
                  }}
                >
                  {FAVORITE_EMOJIS.map((emoji) => (
                    <Button
                      key={`favorite-${emoji}`}
                      onClick={() => appendEmoji(emoji)}
                      sx={{
                        minWidth: 0,
                        width: '100%',
                        height: { xs: 52, sm: 58 },
                        borderRadius: 2.4,
                        p: 0,
                        fontSize: { xs: '1.95rem', sm: '2.2rem' },
                        lineHeight: 1,
                        backgroundColor: 'transparent',
                        transition: 'background-color 160ms ease, transform 160ms ease',
                        '&:hover': {
                          backgroundColor: alpha('#fff', 0.72),
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}

            {emojiPanelTab === 'gif' && (
              <Paper
                elevation={0}
                sx={{
                  px: 2.2,
                  py: 2.4,
                  borderRadius: 3,
                  backgroundColor: alpha('#fff', 0.58),
                  border: `1px solid ${alpha('#6e3a25', 0.08)}`,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#6a483d' }}>
                  GIF 面板
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.75, color: alpha('#4d2d21', 0.68), lineHeight: 1.8 }}>
                  这里预留给 GIF 表情。当前先统一成和 QQ 类似的面板布局，后续可以继续接入真实 GIF 数据。
                </Typography>
              </Paper>
            )}
          </Box>

          <Divider sx={{ borderColor: alpha('#6e3a25', 0.07) }} />

          <Stack direction="row" spacing={1} sx={{ px: 1.4, py: 1.1 }}>
            {[
              { key: 'emoji', label: '表情', icon: <SentimentSatisfiedAltRoundedIcon fontSize="large" /> },
              { key: 'favorite', label: '收藏', icon: <FavoriteBorderRoundedIcon fontSize="large" /> },
              { key: 'gif', label: 'GIF', icon: <GifBoxRoundedIcon fontSize="large" /> },
            ].map((item) => {
              const active = emojiPanelTab === item.key;

              return (
                <Button
                  key={item.key}
                  onClick={() => setEmojiPanelTab(item.key as EmojiPanelTab)}
                  sx={{
                    minWidth: 78,
                    px: 1.8,
                    py: 1.2,
                    borderRadius: 3,
                    color: active ? '#2f1811' : alpha('#6b4b40', 0.86),
                    backgroundColor: active ? alpha('#ede5e1', 0.92) : 'transparent',
                    boxShadow: active ? `inset 0 0 0 1px ${alpha('#6e3a25', 0.05)}` : 'none',
                    '&:hover': {
                      backgroundColor: active ? alpha('#ede5e1', 0.98) : alpha('#fff', 0.42),
                    },
                  }}
                >
                  <Stack spacing={0.45} sx={{ alignItems: 'center' }}>
                    {item.icon}
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {item.label}
                    </Typography>
                  </Stack>
                </Button>
              );
            })}
          </Stack>
        </Box>
      </Menu>

      <MessageContactEditorDialog
        open={contactDialogOpen}
        editingContactUserId={editingContactUserId}
        searchKeyword={contactSearchKeyword}
        onSearchKeywordChange={setContactSearchKeyword}
        onSearchUsers={() => void handleSearchUsers()}
        onNextBatch={() => void handleNextContactBatch()}
        searchingUsers={messageStore.searchingUsers}
        userSearchResults={messageStore.userSearchResults}
        selectedContactUserId={selectedContactUserId}
        onSelectUser={(user) => {
          setSelectedContactUserId(user.id);
          setSelectedContactPreview(user);
          setContactAlias((current) => current || user.alias || user.username);
        }}
        selectedContactPreview={selectedContactPreview}
        requestMessage={friendRequestMessage}
        onRequestMessageChange={setFriendRequestMessage}
        alias={contactAlias}
        onAliasChange={setContactAlias}
        pinned={contactPinned}
        onPinnedChange={setContactPinned}
        onClose={() => {
          setContactDialogOpen(false);
          resetContactDialog();
        }}
        onSubmit={() => void saveContact()}
        saving={contactSaving}
        submitLabel={
          editingContactUserId
            ? '保存'
            : selectedIncomingFriendRequestId
              ? '同意并加为好友'
              : selectedOutgoingFriendRequestPending
                ? '等待对方验证'
                : '发送申请'
        }
        submitDisabled={contactSaving || !selectedContactUserId || Boolean(!editingContactUserId && selectedOutgoingFriendRequestPending)}
      />

      <MessageDeleteContactDialog
        open={Boolean(deleteContactTarget)}
        label={deleteContactTarget?.label ?? ''}
        deleting={contactDeleting}
        onClose={() => setDeleteContactTarget(null)}
        onConfirm={() => void handleDeleteContact()}
      />

      <Dialog
        open={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{previewImage?.label ?? '图片预览'}</DialogTitle>
        <DialogContent sx={{ p: { xs: 1.5, md: 2 } }}>
          {previewImage && (
            <Box
              component="img"
              src={previewImage.url}
              alt={previewImage.label}
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '80vh',
                mx: 'auto',
                borderRadius: 2,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
});

export default MessagePage;
