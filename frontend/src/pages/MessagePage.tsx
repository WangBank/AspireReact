import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogContent,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import MessageContactEditorDialog from '../components/Message/MessageContactEditorDialog';
import MessageDeleteContactDialog from '../components/Message/MessageDeleteContactDialog';
import { formatLastSeen, formatTime } from '../components/Message/messageFormatters';
import PageHeader from '../components/Page/PageHeader';
import RouteLoadingFallback from '../components/Page/RouteLoadingFallback';
import SectionCard from '../components/Page/SectionCard';
import type { MessageUserSummary } from '../services/MessageService';
import { useStore } from '../stores/StoreProvider';

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
  const [contactSearchKeyword, setContactSearchKeyword] = useState('');
  const [contactAlias, setContactAlias] = useState('');
  const [selectedContactUserId, setSelectedContactUserId] = useState<number | null>(null);
  const [selectedContactPreview, setSelectedContactPreview] = useState<MessageUserSummary | null>(null);
  const [contactPinned, setContactPinned] = useState(false);
  const [editingContactUserId, setEditingContactUserId] = useState<number | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [deleteContactTarget, setDeleteContactTarget] = useState<{ userId: number; label: string } | null>(null);
  const [contactDeleting, setContactDeleting] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    void messageStore.initialize();
    return () => {
      void messageStore.dispose();
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

  const handleSearchUsers = async () => {
    await messageStore.searchUsers(contactSearchKeyword);
  };

  const resetContactDialog = () => {
    setSelectedContactUserId(null);
    setSelectedContactPreview(null);
    setContactAlias('');
    setContactPinned(false);
    setEditingContactUserId(null);
    setContactSearchKeyword('');
    messageStore.clearUserSearchResults();
  };

  const openCreateContactDialog = () => {
    resetContactDialog();
    setContactDialogOpen(true);
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
        await messageStore.startDirectConversation(selectedContactUserId);
      }

      setContactDialogOpen(false);
      resetContactDialog();
    } finally {
      setContactSaving(false);
    }
  };

  const sendMessage = async () => {
    await messageStore.sendMessage(composerText, selectedImage, replyTarget?.id);
    setComposerText('');
    setSelectedImage(null);
    setReplyTargetId(null);
  };

  const openGlobalSearchHit = async (conversationId: number, messageId: number) => {
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

  if (messageStore.loading && messageStore.conversations.length === 0 && messageStore.contacts.length === 0) {
    return <RouteLoadingFallback label="消息模块加载中..." minHeight={320} compact />;
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Messaging"
        title="站内消息"
        subtitle="支持联系人维护、文本与图片消息、消息历史查询和在线状态展示。当前版本使用自建库表和 SignalR 实时推送。"
        actions={(
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip
              color={messageStore.realtimeStatus === 'connected' ? 'success' : 'default'}
              label={`实时通道：${messageStore.realtimeStatus === 'connected' ? '已连接' : messageStore.realtimeStatus}`}
            />
            <Button variant="outlined" onClick={() => navigate('/messages/contacts')}>
              联系人管理
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateContactDialog}>
              添加联系人
            </Button>
          </Stack>
        )}
        stats={[
          { label: '会话数', value: messageStore.conversations.length },
          { label: '联系人', value: messageStore.contacts.length },
          { label: '未读消息', value: unreadCount },
          { label: '在线联系人', value: onlineCount },
        ]}
      />

      {messageStore.error && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={messageStore.clearError}>
          {messageStore.error}
        </Alert>
      )}

      <SectionCard
        title="全局消息搜索"
        description="跨会话搜索历史文本和图片文件名，适合快速定位很久以前的聊天记录。"
        actions={(
          <Stack direction="row" spacing={1}>
            {messageStore.globalMessageSearchResult && (
              <Button variant="text" onClick={messageStore.clearGlobalMessageSearch}>
                清空结果
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<AutorenewRoundedIcon />}
              onClick={() => void messageStore.searchAllMessages(globalMessageKeyword)}
              disabled={messageStore.searchingMessages || !globalMessageKeyword.trim()}
            >
              刷新
            </Button>
          </Stack>
        )}
      >
        <Stack spacing={1.5}>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'minmax(0, 1fr) auto',
              },
              alignItems: 'stretch',
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
              sx={{
                minWidth: { md: 132 },
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {messageStore.searchingMessages ? '搜索中...' : '全局搜索'}
            </Button>
          </Box>

          {messageStore.globalMessageSearchResult && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                共找到 {messageStore.globalMessageSearchResult.total} 条消息，点击结果可直接定位到原消息
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: 280, overflowY: 'auto' }}>
                {messageStore.globalMessageSearchResult.hits.map((hit) => (
                  <Paper
                    key={`${hit.conversationId}-${hit.message.id}`}
                    variant="outlined"
                    sx={{
                      borderRadius: 2.5,
                      p: 1.25,
                      cursor: 'pointer',
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: theme.shadows[3],
                      },
                    }}
                    onClick={() => void openGlobalSearchHit(hit.conversationId, hit.message.id)}
                  >
                    <Stack spacing={0.45}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
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
      </SectionCard>

      <SectionCard
        title="消息工作台"
        description="左侧管理会话与联系人，右侧查看历史并发送文字/图片消息。"
        actions={(
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => {
              void messageStore.loadConversations(conversationKeyword);
              void messageStore.loadContacts(contactKeyword);
            }}
          >
            刷新
          </Button>
        )}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              lg: '340px minmax(0, 1fr)',
            },
          }}
        >
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ borderRadius: 3, p: 1.5, backgroundColor: alpha(theme.palette.background.default, 0.7) }}>
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'minmax(0, 1fr) auto',
                    },
                    alignItems: 'stretch',
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
                  />
                  <Button
                    variant="outlined"
                    startIcon={<SearchRoundedIcon />}
                    onClick={() => void messageStore.loadConversations(conversationKeyword)}
                    sx={{ minWidth: { sm: 96 }, whiteSpace: 'nowrap' }}
                  >
                    搜索
                  </Button>
                </Box>

                <List disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {messageStore.conversations.map((conversation) => (
                    <ListItemButton
                      key={conversation.conversationId}
                      selected={messageStore.selectedConversationId === conversation.conversationId}
                      onClick={() => void messageStore.selectConversation(conversation.conversationId)}
                      sx={{
                        borderRadius: 2,
                        mb: 0.75,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Badge
                        color="error"
                        overlap="circular"
                        variant={conversation.unreadCount > 0 ? 'standard' : 'dot'}
                        badgeContent={conversation.unreadCount > 0 ? conversation.unreadCount : 0}
                        invisible={conversation.unreadCount === 0}
                      >
                        <Avatar src={conversation.peer.avatarUrl ?? undefined} alt={conversation.peer.username}>
                          {conversation.peer.username.slice(0, 1).toUpperCase()}
                        </Avatar>
                      </Badge>
                      <ListItemText
                        sx={{ ml: 1.25 }}
                        primary={(
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                              {conversation.peer.alias || conversation.peer.username}
                            </Typography>
                            {conversation.peer.isOnline && <Chip size="small" color="success" label="在线" />}
                            {conversation.isPinned && <PushPinRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                            {conversation.isMuted && <VolumeOffRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                          </Stack>
                        )}
                        secondary={(
                          <Stack spacing={0.35} sx={{ mt: 0.45 }}>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {conversation.lastMessagePreview || '还没有消息，点击开始对话'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : formatLastSeen(conversation.peer.isOnline, conversation.peer.lastSeenAt)}
                            </Typography>
                          </Stack>
                        )}
                      />
                    </ListItemButton>
                  ))}
                  {messageStore.conversations.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
                      暂无会话，可以先添加联系人或直接搜索用户发起对话。
                    </Typography>
                  )}
                </List>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 3, p: 1.5, backgroundColor: alpha(theme.palette.background.default, 0.7) }}>
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'minmax(0, 1fr) auto',
                    },
                    alignItems: 'stretch',
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
                  <Button
                    variant="outlined"
                    startIcon={<SearchRoundedIcon />}
                    onClick={() => void messageStore.loadContacts(contactKeyword)}
                    sx={{ minWidth: { sm: 96 }, whiteSpace: 'nowrap' }}
                  >
                    搜索
                  </Button>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  共 {messageStore.contacts.length} 位联系人，置顶 {pinnedContactCount} 位
                </Typography>

                <List disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
                  {messageStore.contacts.map((contact) => (
                    <ListItemButton
                      key={contact.contactUserId}
                      onClick={() => {
                        if (contact.conversationId) {
                          void messageStore.selectConversation(contact.conversationId);
                        } else {
                          void messageStore.startDirectConversation(contact.contactUserId);
                        }
                      }}
                      sx={{ borderRadius: 2, mb: 0.75 }}
                    >
                      <Avatar src={contact.avatarUrl ?? undefined} alt={contact.username}>
                        {contact.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <ListItemText
                        sx={{ ml: 1.25 }}
                        primary={contact.alias || contact.username}
                        secondary={formatLastSeen(contact.isOnline, contact.lastSeenAt)}
                      />
                      <Stack direction="row" spacing={0.25}>
                        <Tooltip title="编辑联系人">
                          <IconButton size="small" onClick={(event) => {
                            event.stopPropagation();
                            openEditContactDialog(contact.contactUserId);
                          }}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除联系人">
                          <IconButton size="small" color="error" onClick={(event) => {
                            event.stopPropagation();
                            confirmDeleteContact(contact.contactUserId, contact.alias || contact.username);
                          }}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </ListItemButton>
                  ))}
                  {messageStore.contacts.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
                      暂无联系人。
                    </Typography>
                  )}
                </List>
              </Stack>
            </Paper>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 680,
              background: [
                `radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.08)}, transparent 28%)`,
                alpha(theme.palette.background.paper, 0.98),
              ].join(','),
            }}
          >
            {currentSummary ? (
              <>
                <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}` }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                      <Avatar src={currentSummary.peer.avatarUrl ?? undefined} alt={currentSummary.peer.username}>
                        {currentSummary.peer.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {currentSummary.peer.alias || currentSummary.peer.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatLastSeen(currentSummary.peer.isOnline, currentSummary.peer.lastSeenAt)}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack
                      direction={{ xs: 'column', xl: 'row' }}
                      spacing={1.25}
                      sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', xl: 'center' } }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          color={currentPeerContact ? 'success' : 'default'}
                          label={currentPeerContact ? '已加入联系人' : '未加入联系人'}
                        />
                        <Button
                          variant={currentSummary.isPinned ? 'contained' : 'outlined'}
                          size="small"
                          startIcon={<PushPinRoundedIcon />}
                          sx={{ whiteSpace: 'nowrap' }}
                          onClick={() => void toggleConversationPinned()}
                        >
                          {currentSummary.isPinned ? '取消会话置顶' : '会话置顶'}
                        </Button>
                        <Button
                          variant={currentSummary.isMuted ? 'contained' : 'outlined'}
                          size="small"
                          startIcon={<VolumeOffRoundedIcon />}
                          sx={{ whiteSpace: 'nowrap' }}
                          onClick={() => void toggleConversationMuted()}
                        >
                          {currentSummary.isMuted ? '取消静音' : '静音会话'}
                        </Button>
                        {currentPeerContact ? (
                          <>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<EditRoundedIcon />}
                              sx={{ whiteSpace: 'nowrap' }}
                              onClick={() => openEditContactDialog(currentPeerContact.contactUserId)}
                            >
                              编辑联系人
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              color="error"
                              startIcon={<DeleteOutlineRoundedIcon />}
                              sx={{ whiteSpace: 'nowrap' }}
                              onClick={() => confirmDeleteContact(
                                currentPeerContact.contactUserId,
                                currentPeerContact.alias || currentPeerContact.username,
                              )}
                            >
                              删除联系人
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddRoundedIcon />}
                            sx={{ whiteSpace: 'nowrap' }}
                            onClick={() => openCreateContactDialogForUser(currentSummary.peer)}
                          >
                            添加联系人
                          </Button>
                        )}
                      </Stack>

                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1,
                          gridTemplateColumns: {
                            xs: '1fr',
                            md: 'minmax(0, 1fr) auto auto',
                          },
                          width: { xs: '100%', xl: 'min(100%, 520px)' },
                          alignItems: 'stretch',
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
                        />
                        <Button
                          variant="outlined"
                          startIcon={<SearchRoundedIcon />}
                          sx={{ minWidth: { md: 96 }, whiteSpace: 'nowrap' }}
                          onClick={() => void messageStore.searchMessages(messageKeyword)}
                        >
                          查询
                        </Button>
                        {messageStore.messageSearchResult ? (
                          <Button
                            variant="text"
                            sx={{ minWidth: { md: 96 }, whiteSpace: 'nowrap' }}
                            onClick={messageStore.clearMessageSearch}
                          >
                            清空
                          </Button>
                        ) : (
                          <Box sx={{ display: { xs: 'none', md: 'block' } }} />
                        )}
                      </Box>
                    </Stack>
                  </Stack>
                </Box>

                {messageStore.messageSearchResult && (
                  <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}` }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      历史查询结果：{messageStore.messageSearchResult.total} 条
                    </Typography>
                    <Stack spacing={0.75} sx={{ maxHeight: 180, overflowY: 'auto' }}>
                      {messageStore.messageSearchResult.messages.map((message) => (
                        <Paper
                          key={message.id}
                          variant="outlined"
                          sx={{
                            borderRadius: 2,
                            p: 1.25,
                            cursor: 'pointer',
                            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: theme.shadows[2],
                            },
                          }}
                          onClick={() => void messageStore.focusMessage(message.conversationId, message.id)}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {message.senderUsername} · {formatTime(message.createdAt)}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.45 }}>
                            {message.isRecalled
                              ? '这条消息已撤回'
                              : (message.textContent || message.imageFileName || '[图片消息]')}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Box sx={{ flex: 1, px: 2.25, py: 1.75, overflowY: 'auto', backgroundColor: alpha(theme.palette.background.default, 0.62) }}>
                  <Stack spacing={1.5}>
                    {messageStore.currentConversation?.hasMore && (
                      <Button variant="text" onClick={() => void messageStore.loadOlderMessages()} disabled={messageStore.messagesLoading}>
                        {messageStore.messagesLoading ? '加载中...' : '加载更早消息'}
                      </Button>
                    )}

                    {messageStore.currentConversation?.messages.map((message) => (
                      <Stack
                        key={message.id}
                        data-message-id={message.id}
                        direction="row"
                        spacing={1.25}
                        sx={{
                          justifyContent: message.isMine ? 'flex-end' : 'flex-start',
                          alignItems: 'flex-end',
                          borderRadius: 3,
                          px: 0.5,
                          py: 0.35,
                          backgroundColor: messageStore.highlightedMessageId === message.id
                            ? alpha(theme.palette.warning.main, 0.18)
                            : 'transparent',
                          transition: 'background-color 0.25s ease',
                        }}
                      >
                        {!message.isMine && (
                          <Avatar src={message.senderAvatarUrl ?? undefined} sx={{ width: 34, height: 34 }}>
                            {message.senderUsername.slice(0, 1).toUpperCase()}
                          </Avatar>
                        )}

                        <Stack
                          spacing={0.55}
                          sx={{
                            maxWidth: { xs: '84%', md: '72%' },
                            alignItems: message.isMine ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                            {message.isMine ? '我' : message.senderUsername}
                          </Typography>
                          <Paper
                            elevation={0}
                            sx={{
                              px: 1.5,
                              py: 1.2,
                              borderRadius: message.isMine ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                              backgroundColor: message.isMine
                                ? theme.palette.primary.main
                                : alpha(theme.palette.background.paper, 0.98),
                              color: message.isMine ? theme.palette.primary.contrastText : theme.palette.text.primary,
                              border: `1px solid ${
                                message.isMine
                                  ? alpha(theme.palette.primary.main, 0.45)
                                  : alpha(theme.palette.divider, 0.82)
                              }`,
                              boxShadow: message.isMine
                                ? `0 10px 28px ${alpha(theme.palette.primary.main, 0.22)}`
                                : `0 8px 22px ${alpha(theme.palette.common.black, 0.06)}`,
                            }}
                          >
                            {message.replyToMessage && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  mb: 0.9,
                                  px: 1,
                                  py: 0.8,
                                  borderRadius: 2,
                                  backgroundColor: message.isMine
                                    ? alpha(theme.palette.common.white, 0.12)
                                    : alpha(theme.palette.primary.main, 0.05),
                                  borderColor: message.isMine
                                    ? alpha(theme.palette.common.white, 0.18)
                                    : alpha(theme.palette.primary.main, 0.12),
                                }}
                              >
                                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                  回复 {message.replyToMessage.senderUsername}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {message.replyToMessage.isRecalled
                                    ? '原消息已撤回'
                                    : (message.replyToMessage.textContent || message.replyToMessage.imageFileName || '[图片消息]')}
                                </Typography>
                              </Paper>
                            )}

                            {message.isRecalled ? (
                              <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.82 }}>
                                {message.isMine ? '你撤回了一条消息' : `${message.senderUsername} 撤回了一条消息`}
                              </Typography>
                            ) : message.textContent ? (
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
                                    borderRadius: 2,
                                    cursor: 'zoom-in',
                                    border: `1px solid ${
                                      message.isMine
                                        ? alpha(theme.palette.common.white, 0.28)
                                        : alpha(theme.palette.divider, 0.75)
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
                          <Stack direction="row" spacing={0.75} sx={{ px: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                            {!message.isRecalled && (
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<ReplyRoundedIcon />}
                                onClick={() => setReplyTargetId(message.id)}
                              >
                                引用
                              </Button>
                            )}
                            {message.canRecall && (
                              <Button
                                size="small"
                                variant="text"
                                color="warning"
                                startIcon={<UndoRoundedIcon />}
                                onClick={() => void messageStore.recallMessage(message.id)}
                              >
                                撤回
                              </Button>
                            )}
                          </Stack>
                          <Typography
                            variant="caption"
                            sx={{
                              px: 0.5,
                              color: alpha(theme.palette.text.secondary, 0.9),
                            }}
                          >
                            {formatTime(message.createdAt)}
                          </Typography>
                        </Stack>

                        {message.isMine && (
                          <Avatar src={authStore.avatarUrl ?? message.senderAvatarUrl ?? undefined} sx={{ width: 34, height: 34 }}>
                            {(authStore.username ?? message.senderUsername).slice(0, 1).toUpperCase()}
                          </Avatar>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Divider />

                <Box sx={{ px: 2.25, py: 1.75 }}>
                  <Stack spacing={1.2}>
                    {replyTarget && (
                      <Paper variant="outlined" sx={{ borderRadius: 2, px: 1.2, py: 0.9 }}>
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
                      <Paper variant="outlined" sx={{ borderRadius: 2, px: 1.2, py: 0.9 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}>
                          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                            {selectedImagePreviewUrl && (
                              <Box
                                component="img"
                                src={selectedImagePreviewUrl}
                                alt={selectedImage.name}
                                sx={{
                                  width: 72,
                                  height: 72,
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

                    <TextField
                      multiline
                      minRows={3}
                      maxRows={8}
                      placeholder="输入站内消息，支持同时附带一张图片"
                      value={composerText}
                      onChange={(event) => setComposerText(event.target.value)}
                    />

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack direction="row" spacing={1}>
                        <Button
                          component="label"
                          variant="outlined"
                          startIcon={<AttachFileRoundedIcon />}
                        >
                          选择图片
                          <input
                            hidden
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                          />
                        </Button>
                      </Stack>

                      <Button
                        variant="contained"
                        startIcon={<SendRoundedIcon />}
                        disabled={messageStore.sending || (!composerText.trim() && !selectedImage)}
                        onClick={() => void sendMessage()}
                      >
                        {messageStore.sending ? '发送中...' : '发送消息'}
                      </Button>
                    </Stack>
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
                }}
              >
                <Stack spacing={1.2} sx={{ textAlign: 'center', maxWidth: 460 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    选择一个会话开始沟通
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    你可以从左侧会话列表进入，或者先添加联系人并发起首条站内消息。
                  </Typography>
                  <Box>
                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateContactDialog}>
                      添加联系人
                    </Button>
                  </Box>
                </Stack>
              </Box>
            )}
          </Paper>
        </Box>
      </SectionCard>

      <MessageContactEditorDialog
        open={contactDialogOpen}
        editingContactUserId={editingContactUserId}
        searchKeyword={contactSearchKeyword}
        onSearchKeywordChange={setContactSearchKeyword}
        onSearchUsers={() => void handleSearchUsers()}
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
        <DialogContent sx={{ p: { xs: 1.5, md: 2 } }}>
          {previewImage && (
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {previewImage.label}
              </Typography>
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
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
});

export default MessagePage;
