import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MessageContactEditorDialog from '../components/Message/MessageContactEditorDialog';
import MessageDeleteContactDialog from '../components/Message/MessageDeleteContactDialog';
import { formatLastSeen, formatTime } from '../components/Message/messageFormatters';
import RouteLoadingFallback from '../components/Page/RouteLoadingFallback';
import type { MessageContact, MessageUserSummary } from '../services/MessageService';
import { useStore } from '../stores/StoreProvider';

const getContactLabel = (contact: MessageContact) => contact.alias?.trim() || contact.username;

const formatCreatedDate = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(value));

const formatRequestDate = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

type MessageContactsLocationState = {
  friendRequestId?: number;
};

const buildSuggestedUserSummary = (user: MessageUserSummary, currentUsername?: string | null) => {
  if (user.friendRequestStatus === 'pending') {
    if (user.friendRequestDirection === 'incoming') {
      return '对方已经向你发来好友申请，处理后就能开始聊天。';
    }

    return '你已经发出好友申请，等待对方确认。';
  }

  if (user.isOnline) {
    return '当前在线，可以先发起好友申请。';
  }

  return currentUsername
    ? `最近状态：${formatLastSeen(user.isOnline, user.lastSeenAt)}，可直接以“${currentUsername}”身份发起申请。`
    : `最近状态：${formatLastSeen(user.isOnline, user.lastSeenAt)}。`;
};

const MessageContactsPage = observer(() => {
  const { authStore, messageStore } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeContactUserId, setActiveContactUserId] = useState<number | null>(null);
  const [contactKeyword, setContactKeyword] = useState('');
  const [userKeyword, setUserKeyword] = useState('');
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
  const [highlightedFriendRequestId, setHighlightedFriendRequestId] = useState<number | null>(null);
  const [userSearchSkip, setUserSearchSkip] = useState(0);
  const [contactSearchSkip, setContactSearchSkip] = useState(0);

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      await Promise.all([
        messageStore.initialize(),
        messageStore.searchUsers('', 0),
      ]);
      if (!disposed) {
        setUserSearchSkip(0);
      }
    };

    void initialize();

    return () => {
      disposed = true;
    };
  }, [messageStore]);

  const pinnedContactCount = useMemo(
    () => messageStore.contacts.filter((item) => item.isPinned).length,
    [messageStore.contacts],
  );
  const onlineContactCount = useMemo(
    () => messageStore.contacts.filter((item) => item.isOnline).length,
    [messageStore.contacts],
  );
  const availableUsers = useMemo(
    () => messageStore.userSearchResults.filter((item) => !item.isContact),
    [messageStore.userSearchResults],
  );
  const filteredAvailableUsers = useMemo(
    () => [...availableUsers].sort((left, right) => {
      if (left.friendRequestStatus === 'pending' && right.friendRequestStatus !== 'pending') {
        return -1;
      }

      if (left.friendRequestStatus !== 'pending' && right.friendRequestStatus === 'pending') {
        return 1;
      }

      if (left.isOnline !== right.isOnline) {
        return left.isOnline ? -1 : 1;
      }

      return left.username.localeCompare(right.username, 'zh-CN');
    }),
    [availableUsers],
  );
  const filteredContacts = useMemo(() => {
    const normalizedKeyword = contactKeyword.trim().toLowerCase();
    const items = [...messageStore.contacts].sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      if (left.isOnline !== right.isOnline) {
        return left.isOnline ? -1 : 1;
      }

      return getContactLabel(left).localeCompare(getContactLabel(right), 'zh-CN');
    });

    if (!normalizedKeyword) {
      return items;
    }

    return items.filter((contact) => {
      const label = getContactLabel(contact).toLowerCase();
      const username = contact.username.toLowerCase();
      return label.includes(normalizedKeyword) || username.includes(normalizedKeyword);
    });
  }, [contactKeyword, messageStore.contacts]);

  useEffect(() => {
    if (filteredContacts.length === 0) {
      setActiveContactUserId(null);
      return;
    }

    if (!activeContactUserId || !filteredContacts.some((item) => item.contactUserId === activeContactUserId)) {
      setActiveContactUserId(filteredContacts[0].contactUserId);
    }
  }, [activeContactUserId, filteredContacts]);

  const activeContact = useMemo(
    () => (
      filteredContacts.find((item) => item.contactUserId === activeContactUserId)
      ?? messageStore.contacts.find((item) => item.contactUserId === activeContactUserId)
      ?? null
    ),
    [activeContactUserId, filteredContacts, messageStore.contacts],
  );
  const activeConversation = useMemo(() => {
    if (!activeContact) {
      return null;
    }

    if (activeContact.conversationId) {
      return messageStore.conversations.find((item) => item.conversationId === activeContact.conversationId) ?? null;
    }

    return messageStore.conversations.find((item) => item.peer.id === activeContact.contactUserId) ?? null;
  }, [activeContact, messageStore.conversations]);
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
  const recentFriendRequests = useMemo(
    () => [...messageStore.friendRequests]
      .sort((left, right) => {
        const leftPendingIncoming = left.direction === 'incoming' && left.status === 'pending';
        const rightPendingIncoming = right.direction === 'incoming' && right.status === 'pending';
        if (leftPendingIncoming !== rightPendingIncoming) {
          return leftPendingIncoming ? -1 : 1;
        }

        const leftPending = left.status === 'pending';
        const rightPending = right.status === 'pending';
        if (leftPending !== rightPending) {
          return leftPending ? -1 : 1;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 10),
    [messageStore.friendRequests],
  );

  useEffect(() => {
    const locationState = location.state as MessageContactsLocationState | null;
    const targetRequestId = locationState?.friendRequestId;

    if (!targetRequestId || messageStore.friendRequests.length === 0) {
      return undefined;
    }

    const targetRequest = messageStore.friendRequests.find((item) => item.id === targetRequestId);
    if (!targetRequest) {
      return undefined;
    }

    setHighlightedFriendRequestId(targetRequestId);

    const scrollTimer = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`[data-friend-request-id="${targetRequestId}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    const clearTimer = window.setTimeout(() => {
      setHighlightedFriendRequestId((current) => (current === targetRequestId ? null : current));
    }, 3200);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [location.key, location.state, messageStore.friendRequests]);

  const reloadAvailableUsers = async (skip = userSearchSkip) => {
    setUserSearchSkip(skip);
    await messageStore.searchUsers(userKeyword.trim(), skip);
  };

  const handleNextBatch = async () => {
    const nextSkip = userSearchSkip + 20;
    await messageStore.searchUsers(userKeyword.trim(), nextSkip);
    if (messageStore.userSearchResults.length === 0) {
      await reloadAvailableUsers(0);
      return;
    }

    setUserSearchSkip(nextSkip);
  };

  const handleDialogSearchUsers = async () => {
    setContactSearchSkip(0);
    await messageStore.searchUsers(contactSearchKeyword, 0);
  };

  const handleDialogNextBatch = async () => {
    const nextSkip = contactSearchSkip + 20;
    await messageStore.searchUsers(contactSearchKeyword, nextSkip);
    const availableDialogUsers = messageStore.userSearchResults.filter((item) => !item.isContact);
    if (availableDialogUsers.length === 0) {
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
  };

  const openCreateContactDialog = async () => {
    resetContactDialog();
    setContactDialogOpen(true);
    await messageStore.searchUsers('', 0);
  };

  const openCreateContactDialogForUser = (user: MessageUserSummary) => {
    resetContactDialog();
    setSelectedContactUserId(user.id);
    setSelectedContactPreview(user);
    setContactAlias(user.alias ?? user.username);
    setContactDialogOpen(true);
  };

  const openEditContactDialog = (contactUserId: number) => {
    const contact = messageStore.contacts.find((item) => item.contactUserId === contactUserId);
    if (!contact) {
      return;
    }

    setSelectedContactUserId(contactUserId);
    setSelectedContactPreview({
      id: contact.contactUserId,
      username: contact.username,
      avatarUrl: contact.avatarUrl,
      isOnline: contact.isOnline,
      lastSeenAt: contact.lastSeenAt,
      isContact: true,
      isFriend: contact.isFriend,
      alias: contact.alias,
      friendRequestId: null,
      friendRequestStatus: null,
      friendRequestDirection: null,
    });
    setContactAlias(contact.alias ?? '');
    setContactPinned(contact.isPinned);
    setEditingContactUserId(contactUserId);
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
      await reloadAvailableUsers();
    } finally {
      setContactSaving(false);
    }
  };

  const handleRespondFriendRequest = async (requestId: number, action: 'accept' | 'reject') => {
    await messageStore.respondFriendRequest(requestId, action);
    await reloadAvailableUsers(0);
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
      await reloadAvailableUsers();
    } finally {
      setContactDeleting(false);
    }
  };

  const openConversation = async (contact: MessageContact) => {
    if (contact.conversationId) {
      await messageStore.selectConversation(contact.conversationId);
      navigate('/messages');
      return;
    }

    if (!contact.isFriend) {
      return;
    }

    const started = await messageStore.startDirectConversation(contact.contactUserId);
    if (started) {
      navigate('/messages');
    }
  };

  if (messageStore.loading && messageStore.contacts.length === 0 && messageStore.conversations.length === 0) {
    return <RouteLoadingFallback label="联系人页面加载中..." minHeight={320} compact />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {messageStore.error && (
        <Alert severity="error" onClose={messageStore.clearError}>
          {messageStore.error}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
          minHeight: { lg: 760 },
          overflow: 'hidden',
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRight: { lg: (theme) => `1px solid ${theme.palette.divider}` },
          }}
        >
          <Box sx={{ p: 2, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    联系人
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {messageStore.contacts.length} 人，在线 {onlineContactCount}，置顶 {pinnedContactCount}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <IconButton onClick={() => void openCreateContactDialog()} size="small">
                    <PersonAddRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={() => void messageStore.loadContacts()} size="small">
                    <RefreshRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <TextField
                fullWidth
                size="small"
                placeholder="搜索联系人"
                value={contactKeyword}
                onChange={(event) => setContactKeyword(event.target.value)}
                slotProps={{
                  input: {
                    startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
                  },
                }}
              />
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {filteredContacts.length === 0 ? (
              <Box sx={{ p: 2.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {contactKeyword.trim() ? '没有匹配的联系人。' : '还没有联系人，可以先添加。'}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {filteredContacts.map((contact, index) => (
                  <Box key={contact.contactUserId}>
                    <ListItemButton
                      selected={activeContactUserId === contact.contactUserId}
                      onClick={() => setActiveContactUserId(contact.contactUserId)}
                      sx={{ px: 2, py: 1.25, alignItems: 'flex-start' }}
                    >
                      <Avatar
                        src={contact.avatarUrl ?? undefined}
                        alt={contact.username}
                        sx={{ width: 42, height: 42, mr: 1.25 }}
                      >
                        {contact.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 700, flex: 1 }}>
                            {getContactLabel(contact)}
                          </Typography>
                          {contact.isPinned && <PushPinRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
                          <CircleRoundedIcon
                            sx={{
                              fontSize: 12,
                              color: contact.isOnline ? 'success.main' : 'text.disabled',
                            }}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          @{contact.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {contact.isFriend ? formatLastSeen(contact.isOnline, contact.lastSeenAt) : '等待双方互加'}
                        </Typography>
                      </Box>
                    </ListItemButton>
                    {index < filteredContacts.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2.5, minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    好友申请
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    待处理 {messageStore.pendingIncomingFriendRequestCount}，已发送 {messageStore.pendingOutgoingFriendRequestCount}
                  </Typography>
                </Box>
                <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void messageStore.loadFriendRequests()}>
                  刷新
                </Button>
              </Stack>

              {recentFriendRequests.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  暂时没有好友申请记录。
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {recentFriendRequests.map((request) => {
                    const highlighted = highlightedFriendRequestId === request.id;

                    return (
                      <Paper
                        key={request.id}
                        data-friend-request-id={request.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderColor: highlighted ? 'primary.main' : undefined,
                          backgroundColor: highlighted ? (theme) => alpha(theme.palette.primary.main, 0.04) : undefined,
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1.25}
                          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                        >
                          <Stack direction="row" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                            <Avatar src={request.peer.avatarUrl ?? undefined} alt={request.peer.username}>
                              {request.peer.username.slice(0, 1).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                <Typography sx={{ fontWeight: 700 }}>
                                  {request.peer.alias || request.peer.username}
                                </Typography>
                                <Chip
                                  size="small"
                                  color={
                                    request.status === 'accepted'
                                      ? 'success'
                                      : request.status === 'rejected'
                                        ? 'default'
                                        : request.direction === 'incoming'
                                          ? 'warning'
                                          : 'info'
                                  }
                                  label={
                                    request.status === 'accepted'
                                      ? '已同意'
                                      : request.status === 'rejected'
                                        ? '已拒绝'
                                        : request.direction === 'incoming'
                                          ? '待处理'
                                          : '已发送'
                                  }
                                />
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                @{request.peer.username} · {formatRequestDate(request.createdAt)}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {request.requestMessage?.trim() || '请求添加对方为好友'}
                              </Typography>
                            </Box>
                          </Stack>

                          {request.canAccept || request.canReject ? (
                            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                              <Button size="small" onClick={() => void handleRespondFriendRequest(request.id, 'reject')}>
                                拒绝
                              </Button>
                              <Button size="small" variant="contained" onClick={() => void handleRespondFriendRequest(request.id, 'accept')}>
                                同意
                              </Button>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                              {request.respondedAt ? `处理于 ${formatTime(request.respondedAt)}` : '等待处理'}
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' },
              alignItems: 'start',
            }}
          >
            {activeContact ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Avatar
                        src={activeContact.avatarUrl ?? undefined}
                        alt={activeContact.username}
                        sx={{ width: 64, height: 64 }}
                      >
                        {activeContact.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                            {getContactLabel(activeContact)}
                          </Typography>
                          <Chip
                            size="small"
                            color={activeContact.isOnline ? 'success' : 'default'}
                            label={activeContact.isOnline ? '在线' : '离线'}
                          />
                          <Chip
                            size="small"
                            color={activeContact.isFriend ? 'primary' : 'warning'}
                            label={activeContact.isFriend ? '已互加' : '待互加'}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          @{activeContact.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {formatLastSeen(activeContact.isOnline, activeContact.lastSeenAt)}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        startIcon={<ChatBubbleOutlineRoundedIcon />}
                        disabled={!activeContact.isFriend && !activeContact.conversationId}
                        onClick={() => void openConversation(activeContact)}
                      >
                        {activeContact.isFriend ? '发消息' : activeContact.conversationId ? '查看会话' : '等待同意'}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<EditRoundedIcon />}
                        onClick={() => openEditContactDialog(activeContact.contactUserId)}
                      >
                        编辑
                      </Button>
                      <Button
                        color="error"
                        startIcon={<DeleteOutlineRoundedIcon />}
                        onClick={() => confirmDeleteContact(activeContact.contactUserId, getContactLabel(activeContact))}
                      >
                        删除
                      </Button>
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack spacing={1}>
                    {[
                      ['联系人状态', activeContact.isFriend ? '已互加' : '等待对方添加你'],
                      ['备注', activeContact.alias?.trim() || '未设置'],
                      ['添加时间', formatCreatedDate(activeContact.createdAt)],
                      ['置顶', activeContact.isPinned ? '是' : '否'],
                      ['会话', activeConversation ? '已有历史会话' : '暂无会话'],
                    ].map(([label, value]) => (
                      <Stack key={label} direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ width: 84, flexShrink: 0 }}>
                          {label}
                        </Typography>
                        <Typography variant="body2">{value}</Typography>
                      </Stack>
                    ))}
                  </Stack>

                  {activeConversation && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          最近一条消息
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {activeConversation.lastMessageAt ? formatTime(activeConversation.lastMessageAt) : '--'}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {activeConversation.lastMessagePreview || '暂无消息'}
                          </Typography>
                        </Paper>
                      </Box>
                    </>
                  )}
                </Stack>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  minHeight: 280,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 3,
                }}
              >
                <Stack spacing={1.25} sx={{ maxWidth: 360, textAlign: 'center', alignItems: 'center' }}>
                  <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.light', color: 'primary.main' }}>
                    <GroupRoundedIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    选择一个联系人
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    左侧选择联系人后，这里会显示详情、好友状态和快捷操作。
                  </Typography>
                  <Button variant="contained" startIcon={<PersonAddRoundedIcon />} onClick={() => void openCreateContactDialog()}>
                    添加联系人
                  </Button>
                </Stack>
              </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      添加联系人
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      展示当前不是你联系人的用户，支持搜索和换一批。
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<SearchRoundedIcon />} onClick={() => void reloadAvailableUsers(0)}>
                      搜索
                    </Button>
                    <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void handleNextBatch()}>
                      换一批
                    </Button>
                  </Stack>
                </Stack>

                <TextField
                  fullWidth
                  size="small"
                  placeholder="输入用户名或邮箱"
                  value={userKeyword}
                  onChange={(event) => {
                    setUserKeyword(event.target.value);
                    setUserSearchSkip(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void reloadAvailableUsers(0);
                    }
                  }}
                />

                {filteredAvailableUsers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {messageStore.searchingUsers ? '正在加载推荐用户...' : userKeyword.trim() ? '没有找到可添加的用户。' : '当前没有推荐用户。'}
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {filteredAvailableUsers.slice(0, 8).map((user) => {
                      const isIncomingPending = user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'incoming';
                      const isOutgoingPending = user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'outgoing';

                      return (
                        <Paper key={user.id} variant="outlined" sx={{ p: 1.25 }}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.25}
                            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                          >
                            <Stack direction="row" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                              <Avatar src={user.avatarUrl ?? undefined} alt={user.username}>
                                {user.username.slice(0, 1).toUpperCase()}
                              </Avatar>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                  <Typography sx={{ fontWeight: 700 }} noWrap>
                                    {user.alias || user.username}
                                  </Typography>
                                  <Chip size="small" variant="outlined" label={user.isOnline ? '在线' : '最近活跃'} />
                                  {user.friendRequestStatus === 'pending' && (
                                    <Chip
                                      size="small"
                                      color={isIncomingPending ? 'warning' : 'info'}
                                      label={isIncomingPending ? '待你处理' : '已申请'}
                                    />
                                  )}
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                  @{user.username}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  {buildSuggestedUserSummary(user, authStore.username)}
                                </Typography>
                              </Box>
                            </Stack>

                            <Button
                              variant="contained"
                              disabled={isOutgoingPending}
                              onClick={() => openCreateContactDialogForUser(user)}
                            >
                              {isIncomingPending ? '处理' : isOutgoingPending ? '已申请' : '添加'}
                            </Button>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Paper>

      <MessageContactEditorDialog
        open={contactDialogOpen}
        editingContactUserId={editingContactUserId}
        searchKeyword={contactSearchKeyword}
        onSearchKeywordChange={setContactSearchKeyword}
        onSearchUsers={() => void handleDialogSearchUsers()}
        onNextBatch={() => void handleDialogNextBatch()}
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
          void reloadAvailableUsers();
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
    </Box>
  );
});

export default MessageContactsPage;
