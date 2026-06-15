import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
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
  Tooltip,
  Typography,
} from '@mui/material';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
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
import type { MessageContact, MessageUserSummary } from '../services/MessageService';
import { useStore } from '../stores/StoreProvider';

const QUICK_EMOJIS = ['😀', '😂', '😎', '🥳', '👍', '🙏', '🎉', '❤️'];

const MessagePage = observer(() => {
  const { authStore, messageStore } = useStore();
  const theme = useTheme();
  const navigate = useNavigate();
  const [conversationKeyword, setConversationKeyword] = useState('');
  const [contactKeyword, setContactKeyword] = useState('');
  const [messageKeyword, setMessageKeyword] = useState('');
  const [globalMessageKeyword, setGlobalMessageKeyword] = useState('');
  const [composerText, setComposerText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactsPanelOpen, setContactsPanelOpen] = useState(false);
  const [contactSearchKeyword, setContactSearchKeyword] = useState('');
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
  const [hoveredConversationId, setHoveredConversationId] = useState<number | null>(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
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
    if (!selectedImage) {
      setSelectedImagePreviewUrl(null);
      return undefined;
    }

    const nextUrl = URL.createObjectURL(selectedImage);
    setSelectedImagePreviewUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [selectedImage]);

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
  const onlineCount = useMemo(
    () => {
      const peerIds = new Set<number>();
      messageStore.conversations.forEach((item) => {
        if (item.peer.isOnline) {
          peerIds.add(item.peer.id);
        }
      });
      messageStore.contacts.forEach((item) => {
        if (item.isOnline) {
          peerIds.add(item.contactUserId);
        }
      });
      return peerIds.size;
    },
    [messageStore.contacts, messageStore.conversations],
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
  const pinnedContactCount = useMemo(
    () => messageStore.contacts.filter((item) => item.isPinned).length,
    [messageStore.contacts],
  );
  const replyTarget = useMemo(
    () => messageStore.currentConversation?.messages.find((item) => item.id === replyTargetId) ?? null,
    [messageStore.currentConversation?.messages, replyTargetId],
  );
  const currentCanSend = currentSummary?.peer.isFriend ?? false;
  const currentPeerLabel = currentSummary?.peer.alias || currentSummary?.peer.username || '';
  const compactRealtimeLabel = messageStore.realtimeStatus === 'connected'
    ? '实时同步'
    : messageStore.realtimeStatus === 'reconnecting'
      ? '重连中'
      : messageStore.realtimeStatus === 'connecting'
        ? '连接中'
        : '已断开';
  const canSubmitMessage = currentCanSend
    && !messageStore.sending
    && (composerText.trim().length > 0 || Boolean(selectedImage));

  useEffect(() => {
    if (!currentSummary) {
      setShowConversationSearch(false);
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
    setContactAlias(user.alias ?? '');
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
      } else {
        await messageStore.upsertContact(selectedContactUserId, contactAlias, contactPinned);
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

    const sent = await messageStore.sendMessage(composerText, selectedImage, replyTarget?.id);
    if (!sent) {
      return;
    }

    setComposerText('');
    setSelectedImage(null);
    setReplyTargetId(null);
    setComposerNotice(null);
  };

  const appendEmoji = (emoji: string) => {
    setComposerText((value) => `${value}${emoji}`);
    setEmojiAnchorEl(null);
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

      setSelectedImage(file);
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

  const handleImagePicked = (file: File | null) => {
    setSelectedImage(file);
    if (file) {
      setComposerNotice(null);
    }
  };

  const openConversationForContact = async (contact: MessageContact) => {
    if (contact.conversationId) {
      setContactsPanelOpen(false);
      await messageStore.selectConversation(contact.conversationId);
      return;
    }

    if (!contact.isFriend) {
      return;
    }

    setContactsPanelOpen(false);
    await messageStore.startDirectConversation(contact.contactUserId);
  };

  const openGlobalSearchHit = async (conversationId: number, messageId: number) => {
    setGlobalSearchOpen(false);
    await messageStore.focusMessage(conversationId, messageId);
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
    void messageStore.loadContacts(contactKeyword);
  };

  const openContactsPanel = async () => {
    setContactsPanelOpen(true);
    await messageStore.loadContacts(contactKeyword);
  };

  if (messageStore.loading && messageStore.conversations.length === 0 && messageStore.contacts.length === 0) {
    return <RouteLoadingFallback label="消息模块加载中..." minHeight={320} compact />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {messageStore.error && (
        <Alert severity="error" onClose={messageStore.clearError}>
          {messageStore.error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, md: 0 },
          gridTemplateColumns: {
            xs: '1fr',
            md: '76px 284px minmax(0, 1fr)',
          },
          minHeight: { xs: 'auto', lg: 760 },
          borderRadius: { xs: 4, md: 5 },
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.64)}`,
          boxShadow: `0 24px 64px ${alpha(theme.palette.common.black, 0.08)}`,
          background: `linear-gradient(180deg, ${alpha('#f9dcc7', 0.58)} 0%, ${alpha('#fff7f0', 0.92)} 100%)`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            justifyContent: 'space-between',
            gap: 1.25,
            px: { xs: 1.25, md: 1.1 },
            py: { xs: 1.1, md: 1.4 },
            background: `linear-gradient(180deg, ${alpha('#f6c9a7', 0.42)} 0%, ${alpha('#f7d8c7', 0.72)} 100%)`,
            borderRight: { md: `1px solid ${alpha(theme.palette.divider, 0.52)}` },
            borderBottom: { xs: `1px solid ${alpha(theme.palette.divider, 0.52)}`, md: 'none' },
          }}
        >
          <Stack direction={{ xs: 'row', md: 'column' }} spacing={1} sx={{ alignItems: 'center' }}>
            <Badge color="error" badgeContent={unreadCount > 99 ? '99+' : unreadCount} invisible={unreadCount === 0}>
              <IconButton
                sx={{
                  width: 42,
                  height: 42,
                  color: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.common.white, 0.78),
                  boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                }}
              >
                <ChatBubbleOutlineRoundedIcon />
              </IconButton>
            </Badge>

            <Tooltip title="联系人">
              <IconButton
                onClick={() => void openContactsPanel()}
                sx={{
                  width: 38,
                  height: 38,
                  color: alpha(theme.palette.text.primary, 0.84),
                  backgroundColor: alpha(theme.palette.common.white, 0.5),
                }}
              >
                <GroupRoundedIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="全局搜索">
              <IconButton
                onClick={() => setGlobalSearchOpen(true)}
                sx={{
                  width: 38,
                  height: 38,
                  color: alpha(theme.palette.text.primary, 0.84),
                  backgroundColor: alpha(theme.palette.common.white, 0.5),
                }}
              >
                <ManageSearchRoundedIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="添加联系人">
              <IconButton
                onClick={() => void openCreateContactDialog()}
                sx={{
                  width: 38,
                  height: 38,
                  color: alpha(theme.palette.text.primary, 0.84),
                  backgroundColor: alpha(theme.palette.common.white, 0.5),
                }}
              >
                <PersonAddAlt1RoundedIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="刷新">
              <IconButton
                onClick={refreshWorkspace}
                sx={{
                  width: 38,
                  height: 38,
                  color: alpha(theme.palette.text.primary, 0.84),
                  backgroundColor: alpha(theme.palette.common.white, 0.5),
                }}
              >
                <RefreshRoundedIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              px: 1,
              py: 0.9,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.common.white, 0.52),
              minWidth: { xs: 112, md: 0 },
            }}
          >
            <Stack spacing={0.35}>
              <Typography variant="caption" color="text.secondary">
                {compactRealtimeLabel}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                {onlineCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                在线联系人
              </Typography>
            </Stack>
          </Paper>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            background: `linear-gradient(180deg, ${alpha('#f7d7c4', 0.8)} 0%, ${alpha('#f8e6db', 0.92)} 100%)`,
            borderRight: { md: `1px solid ${alpha(theme.palette.divider, 0.52)}` },
            minHeight: { md: 760 },
          }}
        >
          <Box sx={{ px: 1.6, pt: 1.7, pb: 1.1 }}>
            <Stack spacing={1.4}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                    消息
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {messageStore.conversations.length} 个会话 · {unreadCount} 条未读
                  </Typography>
                </Box>
                <Tooltip title="打开联系人管理页">
                  <IconButton
                    onClick={() => navigate('/messages/contacts')}
                    sx={{
                      width: 34,
                      height: 34,
                      backgroundColor: alpha(theme.palette.common.white, 0.56),
                    }}
                  >
                    <GroupRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                }}
              >
                <TextField
                  size="small"
                  fullWidth
                  placeholder="搜索会话、备注或最后一条消息"
                  value={conversationKeyword}
                  onChange={(event) => setConversationKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void messageStore.loadConversations(conversationKeyword);
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      backgroundColor: alpha(theme.palette.common.white, 0.62),
                    },
                  }}
                />
                <IconButton
                  onClick={() => void messageStore.loadConversations(conversationKeyword)}
                  sx={{
                    width: 36,
                    height: 36,
                    backgroundColor: alpha(theme.palette.common.white, 0.62),
                  }}
                >
                  <SearchRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            </Stack>
          </Box>

          <List disablePadding sx={{ flex: 1, overflowY: 'auto', px: 0.95, pb: 1 }}>
            {messageStore.conversations.map((conversation) => (
              <ListItemButton
                key={conversation.conversationId}
                selected={messageStore.selectedConversationId === conversation.conversationId}
                onClick={() => void messageStore.selectConversation(conversation.conversationId)}
                onMouseEnter={() => setHoveredConversationId(conversation.conversationId)}
                onMouseLeave={() => {
                  setHoveredConversationId((current) => (
                    current === conversation.conversationId ? null : current
                  ));
                }}
                sx={{
                  mb: 0.7,
                  px: 1,
                  py: 0.95,
                  borderRadius: 2.6,
                  alignItems: 'flex-start',
                  backgroundColor: messageStore.selectedConversationId === conversation.conversationId
                    ? alpha(theme.palette.common.white, 0.6)
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.common.white, 0.48),
                  },
                }}
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
                    sx={{ width: 42, height: 42 }}
                  >
                    {conversation.peer.username.slice(0, 1).toUpperCase()}
                  </Avatar>
                </Badge>

                <Box sx={{ ml: 1.05, minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                      {conversation.peer.alias || conversation.peer.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontSize: '0.68rem' }}>
                      {conversation.lastMessageAt
                        ? formatTime(conversation.lastMessageAt)
                        : formatLastSeen(conversation.peer.isOnline, conversation.peer.lastSeenAt)}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 0.55, alignItems: 'center', minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ flex: 1, minWidth: 0, fontSize: '0.82rem' }}
                    >
                      {conversation.lastMessagePreview || '还没有消息，点击开始对话'}
                    </Typography>
                    <Stack direction="row" spacing={0.35} sx={{ alignItems: 'center', flexShrink: 0 }}>
                      {conversation.peer.isOnline && (
                        <Tooltip title="在线">
                          <CircleRoundedIcon sx={{ fontSize: 12, color: theme.palette.success.main }} />
                        </Tooltip>
                      )}
                      {!conversation.peer.isFriend && (
                        <Tooltip title="待对方同意">
                          <PersonAddAlt1RoundedIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
                        </Tooltip>
                      )}
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={0.15}
                      sx={{
                        alignItems: 'center',
                        flexShrink: 0,
                        opacity: hoveredConversationId === conversation.conversationId
                          || messageStore.selectedConversationId === conversation.conversationId
                          || conversation.isPinned
                          || conversation.isMuted
                          ? 1
                          : 0,
                        transform: hoveredConversationId === conversation.conversationId
                          || messageStore.selectedConversationId === conversation.conversationId
                          || conversation.isPinned
                          || conversation.isMuted
                          ? 'translateX(0)'
                          : 'translateX(4px)',
                        transition: 'opacity 0.18s ease, transform 0.18s ease',
                      }}
                    >
                      <Tooltip title={conversation.isPinned ? '取消置顶' : '置顶会话'}>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            void messageStore.updateConversationSettings(
                              conversation.conversationId,
                              !conversation.isPinned,
                              conversation.isMuted,
                            );
                          }}
                          sx={{
                            width: 24,
                            height: 24,
                            color: conversation.isPinned ? theme.palette.primary.main : alpha(theme.palette.text.secondary, 0.68),
                          }}
                        >
                          <PushPinRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={conversation.isMuted ? '取消静音' : '静音会话'}>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            void messageStore.updateConversationSettings(
                              conversation.conversationId,
                              conversation.isPinned,
                              !conversation.isMuted,
                            );
                          }}
                          sx={{
                            width: 24,
                            height: 24,
                            color: conversation.isMuted ? theme.palette.warning.dark : alpha(theme.palette.text.secondary, 0.68),
                          }}
                        >
                          <VolumeOffRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              </ListItemButton>
            ))}

            {messageStore.conversations.length === 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: alpha(theme.palette.common.white, 0.48),
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  暂无会话。先添加联系人，双方互相添加后才能继续发起聊天。
                </Typography>
              </Paper>
            )}
          </List>
        </Box>

        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: { md: 760 },
            backgroundColor: alpha(theme.palette.background.paper, 0.9),
          }}
        >
          {currentSummary ? (
            <>
              <Box
                sx={{
                  px: { xs: 1.6, md: 2.5 },
                  py: { xs: 1.35, md: 1.8 },
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.58)}`,
                  backgroundColor: alpha(theme.palette.common.white, 0.56),
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Stack spacing={1.3}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.2}
                    sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                  >
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Avatar
                        src={currentSummary.peer.avatarUrl ?? undefined}
                        alt={currentSummary.peer.username}
                        sx={{ width: 48, height: 48 }}
                      >
                        {currentSummary.peer.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', minWidth: 0 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
                            {currentPeerLabel}
                          </Typography>
                          {currentSummary.peer.isOnline && (
                            <CircleRoundedIcon sx={{ fontSize: 13, color: theme.palette.success.main }} />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {currentCanSend
                            ? formatLastSeen(currentSummary.peer.isOnline, currentSummary.peer.lastSeenAt)
                            : '待双方互相添加后才能继续发送新消息'}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={0.65} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Tooltip title={showConversationSearch ? '收起会话搜索' : '搜索当前会话'}>
                        <IconButton
                          onClick={() => setShowConversationSearch((value) => !value)}
                          sx={{ backgroundColor: alpha(theme.palette.common.white, 0.72) }}
                        >
                          <SearchRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="联系人列表">
                        <IconButton
                          onClick={() => void openContactsPanel()}
                          sx={{ backgroundColor: alpha(theme.palette.common.white, 0.72) }}
                        >
                          <GroupRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {currentPeerContact ? (
                        <Tooltip title="编辑联系人">
                          <IconButton
                            onClick={() => openEditContactDialog(currentPeerContact.contactUserId)}
                            sx={{ backgroundColor: alpha(theme.palette.common.white, 0.72) }}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="添加联系人">
                          <IconButton
                            onClick={() => openCreateContactDialogForUser(currentSummary.peer)}
                            sx={{ backgroundColor: alpha(theme.palette.common.white, 0.72) }}
                          >
                            <PersonAddAlt1RoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {currentPeerContact && (
                        <Tooltip title="删除联系人">
                          <IconButton
                            color="error"
                            onClick={() => confirmDeleteContact(
                              currentPeerContact.contactUserId,
                              currentPeerContact.alias || currentPeerContact.username,
                            )}
                            sx={{ backgroundColor: alpha(theme.palette.common.white, 0.72) }}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      <Tooltip title={currentSummary.isPinned ? '取消会话置顶' : '置顶会话'}>
                        <IconButton
                          onClick={() => void toggleConversationPinned()}
                          sx={{
                            backgroundColor: currentSummary.isPinned
                              ? alpha(theme.palette.primary.main, 0.16)
                              : alpha(theme.palette.common.white, 0.72),
                            color: currentSummary.isPinned ? theme.palette.primary.main : undefined,
                          }}
                        >
                          <PushPinRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={currentSummary.isMuted ? '取消静音' : '静音会话'}>
                        <IconButton
                          onClick={() => void toggleConversationMuted()}
                          sx={{
                            backgroundColor: currentSummary.isMuted
                              ? alpha(theme.palette.warning.main, 0.18)
                              : alpha(theme.palette.common.white, 0.72),
                            color: currentSummary.isMuted ? theme.palette.warning.dark : undefined,
                          }}
                        >
                          <VolumeOffRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  {showConversationSearch && (
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1,
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: 'minmax(0, 1fr) auto auto',
                        },
                      }}
                    >
                      <TextField
                        size="small"
                        placeholder="搜索当前会话历史"
                        value={messageKeyword}
                        onChange={(event) => setMessageKeyword(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            void messageStore.searchMessages(messageKeyword);
                          }
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 3,
                            backgroundColor: alpha(theme.palette.common.white, 0.78),
                          },
                        }}
                      />
                      <Button
                        variant="contained"
                        startIcon={<SearchRoundedIcon />}
                        onClick={() => void messageStore.searchMessages(messageKeyword)}
                        disabled={messageStore.searchingMessages || !messageKeyword.trim()}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {messageStore.searchingMessages ? '搜索中...' : '查询'}
                      </Button>
                      {messageStore.messageSearchResult ? (
                        <Button variant="text" onClick={messageStore.clearMessageSearch} sx={{ whiteSpace: 'nowrap' }}>
                          清空
                        </Button>
                      ) : (
                        <Box sx={{ display: { xs: 'none', md: 'block' } }} />
                      )}
                    </Box>
                  )}
                </Stack>
              </Box>

              {messageStore.messageSearchResult && (
                <Box
                  sx={{
                    px: { xs: 1.4, md: 2.4 },
                    py: 1.3,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.52)}`,
                    backgroundColor: alpha(theme.palette.common.white, 0.42),
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    查询结果 {messageStore.messageSearchResult.total} 条
                  </Typography>
                  <Stack spacing={0.85} sx={{ maxHeight: 180, overflowY: 'auto' }}>
                    {messageStore.messageSearchResult.messages.map((message) => (
                      <Paper
                        key={message.id}
                        variant="outlined"
                        sx={{
                          px: 1.2,
                          py: 1,
                          borderRadius: 2.5,
                          cursor: 'pointer',
                          backgroundColor: alpha(theme.palette.common.white, 0.7),
                        }}
                        onClick={() => void messageStore.focusMessage(message.conversationId, message.id)}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {message.senderUsername} · {formatTime(message.createdAt)}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.35 }}>
                          {message.isRecalled
                            ? '这条消息已撤回'
                            : (message.textContent || message.imageFileName || '[图片消息]')}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              <Box
                sx={{
                  position: 'relative',
                  flex: 1,
                  overflow: 'hidden',
                  background: [
                    `radial-gradient(circle at 18% 16%, ${alpha('#fff6ee', 0.92)}, transparent 22%)`,
                    `radial-gradient(circle at 78% 10%, ${alpha('#ffd8c0', 0.58)}, transparent 22%)`,
                    `radial-gradient(circle at 72% 78%, ${alpha('#ffe8b6', 0.42)}, transparent 26%)`,
                    `linear-gradient(180deg, ${alpha('#f5d6c8', 0.72)} 0%, ${alpha('#f9ebe0', 0.88)} 52%, ${alpha('#fff7ef', 0.96)} 100%)`,
                  ].join(','),
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.4,
                    backgroundImage: [
                      `radial-gradient(${alpha(theme.palette.common.white, 0.75)} 1px, transparent 1px)`,
                      `linear-gradient(135deg, transparent 40%, ${alpha('#f7c6aa', 0.18)} 50%, transparent 60%)`,
                    ].join(','),
                    backgroundSize: '28px 28px, 420px 420px',
                    pointerEvents: 'none',
                  }}
                />

                <Box
                  sx={{
                    position: 'relative',
                    height: '100%',
                    overflowY: 'auto',
                    px: { xs: 1.35, md: 2.2 },
                    py: { xs: 1.4, md: 1.8 },
                  }}
                >
                  <Stack spacing={1.65}>
                    {messageStore.currentConversation?.hasMore && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Button
                          variant="text"
                          onClick={() => void messageStore.loadOlderMessages()}
                          disabled={messageStore.messagesLoading}
                        >
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
                        <Stack key={message.id} spacing={0.55}>
                          {showTimeDivider && (
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', py: 0.25 }}>
                              <Box
                                sx={{
                                  width: { xs: 52, md: 84 },
                                  height: '1px',
                                  backgroundColor: alpha(theme.palette.text.secondary, 0.14),
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{
                                  px: 0.9,
                                  py: 0.15,
                                  fontSize: '0.68rem',
                                  color: alpha(theme.palette.text.secondary, 0.78),
                                  backgroundColor: alpha(theme.palette.common.white, 0.38),
                                  borderRadius: 999,
                                  lineHeight: 1.5,
                                }}
                              >
                                {formatTime(message.createdAt)}
                              </Typography>
                              <Box
                                sx={{
                                  width: { xs: 52, md: 84 },
                                  height: '1px',
                                  backgroundColor: alpha(theme.palette.text.secondary, 0.14),
                                }}
                              />
                            </Stack>
                          )}

                          <Stack
                            data-message-id={message.id}
                            direction="row"
                            spacing={0.9}
                            sx={{
                              justifyContent: message.isMine ? 'flex-end' : 'flex-start',
                              alignItems: 'flex-end',
                              px: 0.35,
                              py: 0.18,
                              borderRadius: 3,
                              backgroundColor: messageStore.highlightedMessageId === message.id
                                ? alpha(theme.palette.warning.main, 0.18)
                                : 'transparent',
                              transition: 'background-color 0.25s ease',
                            }}
                          >
                            {!message.isMine && (
                              <Avatar src={message.senderAvatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                                {message.senderUsername.slice(0, 1).toUpperCase()}
                              </Avatar>
                            )}

                            <Stack
                              spacing={0.45}
                              sx={{
                                maxWidth: { xs: '86%', md: '70%' },
                                alignItems: message.isMine ? 'flex-end' : 'flex-start',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ px: 0.4, fontSize: '0.68rem', lineHeight: 1.2 }}
                              >
                                {message.isMine ? '我' : message.senderUsername}
                              </Typography>

                              <Paper
                                elevation={0}
                                sx={{
                                  px: 1.2,
                                  py: 0.95,
                                  borderRadius: message.isMine ? '18px 18px 7px 18px' : '18px 18px 18px 7px',
                                  backgroundColor: message.isMine
                                    ? alpha('#ffa977', 0.92)
                                    : alpha(theme.palette.common.white, 0.88),
                                  color: message.isMine ? '#4b2508' : theme.palette.text.primary,
                                  border: `0.75px solid ${
                                    message.isMine
                                      ? alpha('#f19155', 0.36)
                                      : alpha(theme.palette.divider, 0.56)
                                  }`,
                                  boxShadow: message.isMine
                                    ? `0 7px 16px ${alpha('#f19155', 0.14)}`
                                    : `0 6px 14px ${alpha(theme.palette.common.black, 0.045)}`,
                                }}
                              >
                                {message.replyToMessage && (
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      mb: 0.7,
                                      px: 0.85,
                                      py: 0.65,
                                      borderRadius: 1.8,
                                      backgroundColor: message.isMine
                                        ? alpha(theme.palette.common.white, 0.24)
                                        : alpha(theme.palette.primary.main, 0.045),
                                      borderColor: message.isMine
                                        ? alpha(theme.palette.common.white, 0.28)
                                        : alpha(theme.palette.primary.main, 0.1),
                                    }}
                                  >
                                    <Typography variant="caption" sx={{ opacity: 0.88, fontSize: '0.68rem' }}>
                                      回复 {message.replyToMessage.senderUsername}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 0.2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.82rem' }}>
                                      {message.replyToMessage.isRecalled
                                        ? '原消息已撤回'
                                        : (message.replyToMessage.textContent || message.replyToMessage.imageFileName || '[图片消息]')}
                                    </Typography>
                                  </Paper>
                                )}

                                {message.isRecalled ? (
                                  <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.78, fontSize: '0.86rem' }}>
                                    {message.isMine ? '你撤回了一条消息' : `${message.senderUsername} 撤回了一条消息`}
                                  </Typography>
                                ) : message.textContent ? (
                                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.92rem', lineHeight: 1.48 }}>
                                    {message.textContent}
                                  </Typography>
                                ) : null}

                                {message.imageUrl && !message.isRecalled && (
                                  <Box sx={{ mt: message.textContent ? 0.8 : 0 }}>
                                    <Box
                                      component="img"
                                      src={message.imageUrl}
                                      alt={message.imageFileName || '消息图片'}
                                      sx={{
                                        display: 'block',
                                        maxWidth: '100%',
                                        borderRadius: 2,
                                        cursor: 'zoom-in',
                                        border: `0.75px solid ${
                                          message.isMine
                                            ? alpha(theme.palette.common.white, 0.28)
                                            : alpha(theme.palette.divider, 0.6)
                                        }`,
                                      }}
                                      onClick={() => setPreviewImage({
                                        url: message.imageUrl ?? '',
                                        label: message.imageFileName || '消息图片',
                                      })}
                                    />
                                  </Box>
                                )}
                              </Paper>

                              <Stack direction="row" spacing={0.2} sx={{ alignItems: 'center', px: 0.1 }}>
                                {!showTimeDivider && (
                                  <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.82), fontSize: '0.66rem' }}>
                                    {formatTime(message.createdAt)}
                                  </Typography>
                                )}
                                {!message.isRecalled && currentCanSend && (
                                  <Tooltip title="引用">
                                    <IconButton size="small" onClick={() => setReplyTargetId(message.id)} sx={{ width: 22, height: 22 }}>
                                      <ReplyRoundedIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {message.canRecall && (
                                  <Tooltip title="撤回">
                                    <IconButton
                                      size="small"
                                      color="warning"
                                      onClick={() => void messageStore.recallMessage(message.id)}
                                      sx={{ width: 22, height: 22 }}
                                    >
                                      <UndoRoundedIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
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
              </Box>

              <Divider />

              <Box
                sx={{
                  px: { xs: 1.4, md: 2.2 },
                  py: { xs: 1.3, md: 1.65 },
                  backgroundColor: alpha(theme.palette.common.white, 0.56),
                }}
              >
                <Stack spacing={1.1}>
                  {!currentCanSend && (
                    <Alert severity="info">
                      当前还不是互为好友。你可以查看历史消息，但在双方互相添加之前不能继续发送新消息。
                    </Alert>
                  )}

                  {replyTarget && currentCanSend && (
                    <Paper
                      variant="outlined"
                      sx={{
                        px: 1.2,
                        py: 0.9,
                        borderRadius: 2.5,
                        backgroundColor: alpha(theme.palette.common.white, 0.72),
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            正在回复 {replyTarget.senderUsername}
                          </Typography>
                          <Typography variant="body2" noWrap>
                            {replyTarget.isRecalled
                              ? '原消息已撤回'
                              : (replyTarget.textContent || replyTarget.imageFileName || '[图片消息]')}
                          </Typography>
                        </Box>
                        <Button color="inherit" onClick={() => setReplyTargetId(null)}>
                          取消
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  {selectedImage && (
                    <Paper
                      variant="outlined"
                      sx={{
                        px: 1.2,
                        py: 0.9,
                        borderRadius: 2.5,
                        backgroundColor: alpha(theme.palette.common.white, 0.72),
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.2}
                        sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}
                      >
                        <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', minWidth: 0 }}>
                          {selectedImagePreviewUrl && (
                            <Box
                              component="img"
                              src={selectedImagePreviewUrl}
                              alt={selectedImage.name}
                              sx={{
                                width: 64,
                                height: 64,
                                borderRadius: 2,
                                objectFit: 'cover',
                                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                              }}
                            />
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              已选择图片：{selectedImage.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                          </Box>
                        </Stack>
                        <Button color="inherit" onClick={() => setSelectedImage(null)}>
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

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      borderRadius: 3,
                      backgroundColor: alpha(theme.palette.common.white, 0.78),
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.35}
                      sx={{ mb: 0.8, alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Stack direction="row" spacing={0.3}>
                        <Tooltip title="表情">
                          <IconButton
                            size="small"
                            disabled={!currentCanSend}
                            onClick={(event) => setEmojiAnchorEl(event.currentTarget)}
                          >
                            <SentimentSatisfiedAltRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="从剪贴板读取截图">
                          <IconButton size="small" disabled={!currentCanSend} onClick={() => void readClipboardScreenshot()}>
                            <ScreenshotMonitorRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="选择图片">
                          <IconButton size="small" component="label" disabled={!currentCanSend}>
                            <AddPhotoAlternateRoundedIcon fontSize="small" />
                            <input
                              hidden
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                              onChange={(event) => handleImagePicked(event.target.files?.[0] ?? null)}
                            />
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      <Button
                        variant="contained"
                        endIcon={<SendRoundedIcon />}
                        disabled={!canSubmitMessage}
                        onClick={() => void sendMessage()}
                        sx={{ borderRadius: 999, minWidth: 108 }}
                      >
                        {messageStore.sending ? '发送中...' : '发送'}
                      </Button>
                    </Stack>

                    <Divider sx={{ mb: 0.9 }} />

                    <TextField
                      multiline
                      minRows={1.8}
                      maxRows={6}
                      fullWidth
                      disabled={!currentCanSend}
                      placeholder={currentCanSend ? '输入消息，支持同时附带一张图片' : '待双方互相添加后，才可继续发送消息'}
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
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          p: 0,
                          backgroundColor: 'transparent',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          border: 'none',
                        },
                        '& .MuiInputBase-inputMultiline': {
                          p: 0,
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 0.5,
                        display: 'block',
                        textAlign: 'right',
                        color: alpha(theme.palette.text.secondary, 0.72),
                        fontSize: '0.68rem',
                      }}
                    >
                      Enter 发送 · Shift+Enter 换行
                    </Typography>
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
                px: 3,
                background: [
                  `radial-gradient(circle at 28% 20%, ${alpha('#fff6ee', 0.92)}, transparent 24%)`,
                  `radial-gradient(circle at 75% 18%, ${alpha('#ffd8c0', 0.48)}, transparent 18%)`,
                  `linear-gradient(180deg, ${alpha('#f7d7c4', 0.72)} 0%, ${alpha('#fff8f1', 0.94)} 100%)`,
                ].join(','),
              }}
            >
              <Stack spacing={1.2} sx={{ textAlign: 'center', maxWidth: 420, alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 74,
                    height: 74,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: alpha(theme.palette.common.white, 0.72),
                    boxShadow: `0 14px 32px ${alpha(theme.palette.common.black, 0.08)}`,
                  }}
                >
                  <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 34, color: theme.palette.primary.main }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  选择一个会话
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  从左侧会话列表进入，或者先添加联系人。双方互相添加后，系统才允许发送首条站内消息。
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PersonAddAlt1RoundedIcon />}
                  onClick={() => void openCreateContactDialog()}
                >
                  添加联系人
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>

      <Dialog open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>全局消息搜索</DialogTitle>
        <DialogContent sx={{ pt: 0.5 }}>
          <Stack spacing={1.5}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'minmax(0, 1fr) auto auto',
                },
              }}
            >
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
                sx={{ whiteSpace: 'nowrap' }}
              >
                {messageStore.searchingMessages ? '搜索中...' : '搜索'}
              </Button>
              {messageStore.globalMessageSearchResult ? (
                <Button variant="text" onClick={messageStore.clearGlobalMessageSearch} sx={{ whiteSpace: 'nowrap' }}>
                  清空
                </Button>
              ) : (
                <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
              )}
            </Box>

            {messageStore.globalMessageSearchResult && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  共找到 {messageStore.globalMessageSearchResult.total} 条消息，点击结果可直接定位到原消息
                </Typography>
                <Stack spacing={1} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {messageStore.globalMessageSearchResult.hits.map((hit) => (
                    <Paper
                      key={`${hit.conversationId}-${hit.message.id}`}
                      variant="outlined"
                      sx={{
                        borderRadius: 2.5,
                        p: 1.25,
                        cursor: 'pointer',
                        backgroundColor: alpha(theme.palette.background.paper, 0.9),
                      }}
                      onClick={() => void openGlobalSearchHit(hit.conversationId, hit.message.id)}
                    >
                      <Stack spacing={0.4}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {hit.peer.alias || hit.peer.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {hit.message.senderUsername} · {formatTime(hit.message.createdAt)}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {hit.message.isRecalled
                            ? '这条消息已撤回'
                            : (hit.message.textContent || hit.message.imageFileName || '[图片消息]')}
                        </Typography>
                      </Stack>
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

      <Dialog open={contactsPanelOpen} onClose={() => setContactsPanelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>联系人</DialogTitle>
        <DialogContent sx={{ pt: 0.5 }}>
          <Stack spacing={1.4}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                共 {messageStore.contacts.length} 位联系人，置顶 {pinnedContactCount} 位
              </Typography>
              <Button size="small" onClick={() => navigate('/messages/contacts')}>
                打开管理页
              </Button>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: 'minmax(0, 1fr) auto',
              }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="搜索联系人或备注"
                value={contactKeyword}
                onChange={(event) => setContactKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void messageStore.loadContacts(contactKeyword);
                  }
                }}
              />
              <IconButton onClick={() => void messageStore.loadContacts(contactKeyword)}>
                <SearchRoundedIcon fontSize="small" />
              </IconButton>
            </Box>

            <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
              {messageStore.contacts.map((contact) => (
                <ListItemButton
                  key={contact.contactUserId}
                  disabled={!contact.conversationId && !contact.isFriend}
                  onClick={() => void openConversationForContact(contact)}
                  sx={{ borderRadius: 2.5, mb: 0.8, alignItems: 'flex-start' }}
                >
                  <Avatar src={contact.avatarUrl ?? undefined} alt={contact.username}>
                    {contact.username.slice(0, 1).toUpperCase()}
                  </Avatar>

                  <Box sx={{ ml: 1.2, minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                        {contact.alias || contact.username}
                      </Typography>
                      <Stack direction="row" spacing={0.35} sx={{ alignItems: 'center', flexShrink: 0 }}>
                        {contact.isOnline && (
                          <Tooltip title="在线">
                            <CircleRoundedIcon sx={{ fontSize: 12, color: theme.palette.success.main }} />
                          </Tooltip>
                        )}
                        {!contact.isFriend && (
                          <Tooltip title="待同意">
                            <PersonAddAlt1RoundedIcon sx={{ fontSize: 15, color: theme.palette.warning.main }} />
                          </Tooltip>
                        )}
                        {contact.isPinned && (
                          <Tooltip title="已置顶">
                            <PushPinRoundedIcon sx={{ fontSize: 15, color: alpha(theme.palette.text.secondary, 0.82) }} />
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.3 }}>
                      {formatLastSeen(contact.isOnline, contact.lastSeenAt)}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.25}>
                    <Tooltip title="编辑联系人">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditContactDialog(contact.contactUserId);
                        }}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除联系人">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(event) => {
                          event.stopPropagation();
                          confirmDeleteContact(contact.contactUserId, contact.alias || contact.username);
                        }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItemButton>
              ))}

              {messageStore.contacts.length === 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    暂无联系人。
                  </Typography>
                </Paper>
              )}
            </List>
          </Stack>
        </DialogContent>
      </Dialog>

      <Menu
        anchorEl={emojiAnchorEl}
        open={Boolean(emojiAnchorEl)}
        onClose={() => setEmojiAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <MenuItem key={emoji} onClick={() => appendEmoji(emoji)} sx={{ minWidth: 56, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '1.1rem' }}>{emoji}</Typography>
          </MenuItem>
        ))}
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
        }}
        selectedContactPreview={selectedContactPreview}
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
