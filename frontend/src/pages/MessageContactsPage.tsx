import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  List,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MessageContactEditorDialog from '../components/Message/MessageContactEditorDialog';
import MessageDeleteContactDialog from '../components/Message/MessageDeleteContactDialog';
import { formatLastSeen, formatTime } from '../components/Message/messageFormatters';
import RouteLoadingFallback from '../components/Page/RouteLoadingFallback';
import type { MessageContact, MessageUserSummary } from '../services/MessageService';
import { useStore } from '../stores/StoreProvider';

const getContactLabel = (contact: MessageContact) => contact.alias?.trim() || contact.username;

const formatCreatedDate = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
}).format(new Date(value));

const formatRequestDate = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(value));

const buildSuggestedUserSummary = (user: MessageUserSummary, currentUsername?: string | null) => {
  if (user.friendRequestStatus === 'pending') {
    if (user.friendRequestDirection === 'incoming') {
      return `${user.username} 已向你发来好友申请。处理后就能进入联系人列表继续聊天。`;
    }

    return `你已经向 ${user.username} 发出了好友申请，等待对方确认后即可开始站内聊天。`;
  }

  if (user.isOnline) {
    return `${user.username} 当前在线。现在就可以发起好友申请，等对方同意后开始聊天。`;
  }

  return `${formatLastSeen(user.isOnline, user.lastSeenAt)}。${currentUsername ? `可先以“${currentUsername}”的身份发起好友申请。` : '可先发起好友申请。'}`;
};

const MessageContactsPage = observer(() => {
  const { authStore, messageStore } = useStore();
  const theme = useTheme();
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
  const [userSearchSkip, setUserSearchSkip] = useState(0);
  const [contactSearchSkip, setContactSearchSkip] = useState(0);
  const [availableUserMode, setAvailableUserMode] = useState<'recommended' | 'online' | 'pending'>('recommended');

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
  const filteredAvailableUsers = useMemo(() => {
    const filtered = availableUsers.filter((user) => {
      if (availableUserMode === 'online') {
        return user.isOnline;
      }

      if (availableUserMode === 'pending') {
        return user.friendRequestStatus === 'pending';
      }

      return true;
    });

    return filtered.sort((left, right) => {
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
    });
  }, [availableUserMode, availableUsers]);
  const recentConversations = useMemo(
    () => messageStore.conversations.slice(0, 5),
    [messageStore.conversations],
  );
  const filteredContacts = useMemo(() => {
    const normalizedKeyword = contactKeyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return messageStore.contacts;
    }

    return messageStore.contacts.filter((contact) => {
      const label = getContactLabel(contact).toLowerCase();
      const username = contact.username.toLowerCase();
      return label.includes(normalizedKeyword) || username.includes(normalizedKeyword);
    });
  }, [contactKeyword, messageStore.contacts]);
  const groupedContacts = useMemo(
    () => [
      {
        key: 'pinned',
        label: '置顶联系人',
        items: filteredContacts.filter((item) => item.isPinned),
      },
      {
        key: 'online',
        label: '在线联系人',
        items: filteredContacts.filter((item) => !item.isPinned && item.isOnline),
      },
      {
        key: 'others',
        label: '其他联系人',
        items: filteredContacts.filter((item) => !item.isPinned && !item.isOnline),
      },
    ],
    [filteredContacts],
  );

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
  const alternateRecentConversations = useMemo(
    () => recentConversations.filter((item) => item.conversationId !== activeConversation?.conversationId).slice(0, 3),
    [activeConversation?.conversationId, recentConversations],
  );
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
    () => messageStore.friendRequests.slice(0, 8),
    [messageStore.friendRequests],
  );

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

  const openConversationById = async (conversationId: number) => {
    await messageStore.selectConversation(conversationId);
    navigate('/messages');
  };

  if (messageStore.loading && messageStore.contacts.length === 0 && messageStore.conversations.length === 0) {
    return <RouteLoadingFallback label="联系人页面加载中..." minHeight={320} compact />;
  }

  return (
    <Box sx={{ px: { xs: 0, md: 0.5 }, py: { xs: 0, md: 0.75 } }}>
      {messageStore.error && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={messageStore.clearError}>
          {messageStore.error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',
          borderRadius: { xs: 4, md: 6 },
          border: `1px solid ${alpha('#5a2d16', 0.08)}`,
          background: 'linear-gradient(135deg, #f5c7b6 0%, #f7d7c0 54%, #f4e3be 100%)',
          boxShadow: `0 28px 80px ${alpha('#9c5d39', 0.14)}`,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: '72px 340px minmax(0, 1fr)',
            },
            minHeight: {
              xs: 'auto',
              lg: 'calc(100vh - 196px)',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'row', lg: 'column' },
              alignItems: 'center',
              justifyContent: { xs: 'space-between', lg: 'flex-start' },
              gap: 1.25,
              px: { xs: 1.5, lg: 1 },
              py: { xs: 1.5, lg: 2 },
              borderRight: { lg: `1px solid ${alpha('#5a2d16', 0.08)}` },
              borderBottom: { xs: `1px solid ${alpha('#5a2d16', 0.08)}`, lg: 'none' },
              backgroundColor: alpha('#fff8f4', 0.18),
            }}
          >
            <Stack direction={{ xs: 'row', lg: 'column' }} spacing={1.1}>
              <Tooltip title="消息">
                <IconButton
                  onClick={() => navigate('/messages')}
                  sx={{
                    width: 44,
                    height: 44,
                    backgroundColor: alpha('#fff', 0.4),
                    color: '#5d3020',
                  }}
                >
                  <ChatRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="联系人">
                <IconButton
                  sx={{
                    width: 44,
                    height: 44,
                    backgroundColor: alpha(theme.palette.primary.main, 0.18),
                    color: theme.palette.primary.main,
                  }}
                >
                  <GroupRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="新增联系人">
                <IconButton
                  onClick={() => void openCreateContactDialog()}
                  sx={{
                    width: 44,
                    height: 44,
                    backgroundColor: alpha('#fff', 0.3),
                    color: alpha('#5d3020', 0.86),
                  }}
                >
                  <PersonAddRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="刷新联系人">
                <IconButton
                  onClick={() => void messageStore.loadContacts()}
                  sx={{
                    width: 44,
                    height: 44,
                    backgroundColor: alpha('#fff', 0.3),
                    color: alpha('#5d3020', 0.82),
                  }}
                >
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: alpha('#5d3020', 0.7),
                writingMode: { lg: 'vertical-rl' },
                textOrientation: { lg: 'mixed' },
                letterSpacing: 2,
                display: { xs: 'none', lg: 'block' },
              }}
            >
              CONTACTS
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              px: { xs: 1.5, md: 2 },
              py: { xs: 1.75, md: 2.25 },
              borderRight: { lg: `1px solid ${alpha('#5a2d16', 0.08)}` },
              backgroundColor: alpha('#f8d8c9', 0.42),
            }}
          >
            <Stack spacing={1.4}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="搜索联系人"
                  value={contactKeyword}
                  onChange={(event) => setContactKeyword(event.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start" sx={{ mr: 0.2 }}>
                          <SearchRoundedIcon sx={{ color: alpha('#6e3a25', 0.5) }} fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      backgroundColor: alpha('#fff', 0.28),
                    },
                  }}
                />
                <IconButton
                  onClick={() => void openCreateContactDialog()}
                  sx={{
                    width: 42,
                    height: 42,
                    backgroundColor: alpha('#fff', 0.28),
                    color: alpha('#6e3a25', 0.88),
                  }}
                >
                  <PersonAddRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<GroupRoundedIcon />}
                onClick={() => void openCreateContactDialog()}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 3,
                  py: 1,
                  px: 1.5,
                  borderColor: alpha('#6e3a25', 0.18),
                  backgroundColor: alpha('#fff', 0.18),
                  color: '#422215',
                }}
              >
                好友管理器
              </Button>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={`联系人 ${messageStore.contacts.length}`}
                  sx={{ backgroundColor: alpha('#fff', 0.4) }}
                />
                <Chip
                  size="small"
                  label={`在线 ${onlineContactCount}`}
                  sx={{ backgroundColor: alpha('#fff', 0.25) }}
                />
                <Chip
                  size="small"
                  label={`置顶 ${pinnedContactCount}`}
                  sx={{ backgroundColor: alpha('#fff', 0.25) }}
                />
                <Chip
                  size="small"
                  color={messageStore.pendingIncomingFriendRequestCount > 0 ? 'warning' : 'default'}
                  label={`待处理 ${messageStore.pendingIncomingFriendRequestCount}`}
                />
              </Stack>
            </Stack>

            <Box sx={{ mt: 2, minHeight: 0, flex: 1, overflowY: 'auto', pr: 0.5 }}>
              {filteredContacts.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    px: 2,
                    py: 2.5,
                    borderRadius: 4,
                    backgroundColor: alpha('#fff', 0.22),
                    color: alpha('#4a281c', 0.78),
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    还没有匹配的联系人
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.8, color: alpha('#4a281c', 0.7) }}>
                    {contactKeyword.trim() ? '换个关键词，或者直接新增联系人。' : '可以先从右侧推荐用户里添加联系人。'}
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {groupedContacts.map((section) => (
                    section.items.length > 0 ? (
                      <Box key={section.key}>
                        <Stack
                          direction="row"
                          sx={{
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 0.5,
                            mb: 0.9,
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4a281c' }}>
                            {section.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: alpha('#4a281c', 0.56) }}>
                            {section.items.length}
                          </Typography>
                        </Stack>
                        <List disablePadding>
                          {section.items.map((contact) => {
                            const selected = activeContactUserId === contact.contactUserId;

                            return (
                              <Box key={contact.contactUserId} sx={{ mb: 0.85 }}>
                                <Button
                                  fullWidth
                                  onClick={() => setActiveContactUserId(contact.contactUserId)}
                                  sx={{
                                    px: 1.1,
                                    py: 1,
                                    borderRadius: 3,
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-start',
                                    textTransform: 'none',
                                    color: 'inherit',
                                    backgroundColor: selected ? alpha('#fff', 0.38) : alpha('#fff', 0.14),
                                    border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.18) : alpha('#6e3a25', 0.06)}`,
                                    boxShadow: selected ? `0 12px 30px ${alpha('#814c35', 0.14)}` : 'none',
                                    '&:hover': {
                                      backgroundColor: selected ? alpha('#fff', 0.46) : alpha('#fff', 0.24),
                                    },
                                    '& .contact-actions': {
                                      opacity: { xs: 1, md: selected ? 1 : 0 },
                                    },
                                    '&:hover .contact-actions': {
                                      opacity: 1,
                                    },
                                  }}
                                >
                                  <Stack direction="row" spacing={1.15} sx={{ width: '100%', alignItems: 'flex-start' }}>
                                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                                      <Avatar
                                        src={contact.avatarUrl ?? undefined}
                                        alt={contact.username}
                                        sx={{ width: 46, height: 46 }}
                                      >
                                        {contact.username.slice(0, 1).toUpperCase()}
                                      </Avatar>
                                      <CircleRoundedIcon
                                        sx={{
                                          position: 'absolute',
                                          right: -2,
                                          bottom: -2,
                                          fontSize: 15,
                                          color: contact.isOnline ? '#35c46a' : alpha('#8f6a5a', 0.65),
                                          backgroundColor: '#f6d4c4',
                                          borderRadius: '50%',
                                        }}
                                      />
                                    </Box>

                                    <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                                        <Typography noWrap sx={{ fontWeight: 700, color: '#2f1b14' }}>
                                          {getContactLabel(contact)}
                                        </Typography>
                                        {contact.isPinned && (
                                          <PushPinRoundedIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                                        )}
                                      </Stack>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          display: 'block',
                                          mt: 0.35,
                                          color: alpha('#5f3827', 0.72),
                                        }}
                                        noWrap
                                      >
                                        {contact.isFriend ? `@${contact.username}` : `等待互加 · @${contact.username}`}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          display: 'block',
                                          mt: 0.2,
                                          color: alpha('#5f3827', 0.56),
                                        }}
                                        noWrap
                                      >
                                        {formatLastSeen(contact.isOnline, contact.lastSeenAt)}
                                      </Typography>
                                    </Box>

                                    <Stack
                                      className="contact-actions"
                                      direction="row"
                                      spacing={0.25}
                                      sx={{
                                        ml: 0.25,
                                        transition: 'opacity 160ms ease',
                                      }}
                                    >
                                      <IconButton
                                        size="small"
                                        disabled={!contact.isFriend && !contact.conversationId}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void openConversation(contact);
                                        }}
                                        sx={{ color: alpha('#6a3d29', 0.72) }}
                                      >
                                        <ChatBubbleOutlineRoundedIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openEditContactDialog(contact.contactUserId);
                                        }}
                                        sx={{ color: alpha('#6a3d29', 0.72) }}
                                      >
                                        <EditRoundedIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          confirmDeleteContact(contact.contactUserId, getContactLabel(contact));
                                        }}
                                        sx={{ color: alpha(theme.palette.error.main, 0.8) }}
                                      >
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                      </IconButton>
                                    </Stack>
                                  </Stack>
                                </Button>
                              </Box>
                            );
                          })}
                        </List>
                      </Box>
                    ) : null
                  ))}
                </Stack>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              minWidth: 0,
              px: { xs: 1.5, md: 3.2 },
              py: { xs: 1.8, md: 3 },
              display: 'flex',
              flexDirection: 'column',
              gap: 2.2,
              background: `linear-gradient(180deg, ${alpha('#fff9f4', 0.16)} 0%, ${alpha('#fff6ef', 0.02)} 100%)`,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.6, md: 2 },
                borderRadius: 4,
                backgroundColor: alpha('#fff', 0.16),
                border: `1px solid ${alpha('#6e3a25', 0.08)}`,
              }}
            >
              <Stack spacing={1.4}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#241611' }}>
                      好友通知
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: alpha('#4d2d21', 0.66) }}>
                      这里集中处理别人发来的好友申请，也能看到自己发出的验证状态。
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={`待处理 ${messageStore.pendingIncomingFriendRequestCount}`}
                      color={messageStore.pendingIncomingFriendRequestCount > 0 ? 'warning' : 'default'}
                    />
                    <Chip
                      size="small"
                      label={`已发送 ${messageStore.pendingOutgoingFriendRequestCount}`}
                      variant="outlined"
                    />
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<RefreshRoundedIcon />}
                      onClick={() => void messageStore.loadFriendRequests()}
                      sx={{ whiteSpace: 'nowrap', color: '#512b1d' }}
                    >
                      刷新
                    </Button>
                  </Stack>
                </Stack>

                {recentFriendRequests.length > 0 ? (
                  <Stack spacing={1.2}>
                    {recentFriendRequests.map((request) => (
                      <Paper
                        key={request.id}
                        elevation={0}
                        sx={{
                          px: { xs: 1.4, md: 1.8 },
                          py: { xs: 1.35, md: 1.55 },
                          borderRadius: 3.5,
                          backgroundColor: alpha('#fff', 0.38),
                          border: `1px solid ${alpha('#6e3a25', 0.08)}`,
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1.5}
                          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
                        >
                          <Stack direction="row" spacing={1.2} sx={{ minWidth: 0, alignItems: 'flex-start', flex: 1 }}>
                            <Avatar
                              src={request.peer.avatarUrl ?? undefined}
                              alt={request.peer.username}
                              sx={{ width: 54, height: 54 }}
                            >
                              {request.peer.username.slice(0, 1).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={0.9}
                                sx={{ alignItems: { md: 'center' }, minWidth: 0 }}
                              >
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#2f1b14' }} noWrap>
                                  {request.peer.alias || request.peer.username}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: alpha('#4d2d21', 0.76) }}>
                                  {request.direction === 'incoming' ? '请求加为好友' : '正在验证你的邀请'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: alpha('#4d2d21', 0.56) }}>
                                  {formatRequestDate(request.createdAt)}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" sx={{ mt: 0.2, color: alpha('#4d2d21', 0.6) }}>
                                @{request.peer.username}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.75, color: alpha('#4d2d21', 0.76), lineHeight: 1.7 }}>
                                留言：{request.requestMessage?.trim() || '请求添加对方为好友'}
                              </Typography>
                              {request.requesterAlias?.trim() && (
                                <Typography variant="body2" sx={{ mt: 0.45, color: alpha('#4d2d21', 0.68) }}>
                                  备注：{request.requesterAlias}
                                </Typography>
                              )}
                              <Typography variant="caption" sx={{ mt: 0.45, display: 'block', color: alpha('#4d2d21', 0.56) }}>
                                来源：{request.source || '站内搜索'}
                              </Typography>
                            </Box>
                          </Stack>

                          <Stack
                            direction={{ xs: 'row', sm: 'column' }}
                            spacing={0.85}
                            sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'center', flexShrink: 0 }}
                          >
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
                                      ? '待你处理'
                                      : '等待验证'
                              }
                              sx={{ fontWeight: 700 }}
                            />
                            {request.canAccept || request.canReject ? (
                              <Stack direction="row" spacing={0.75}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="inherit"
                                  onClick={() => void handleRespondFriendRequest(request.id, 'reject')}
                                  sx={{ borderRadius: 999 }}
                                >
                                  拒绝
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => void handleRespondFriendRequest(request.id, 'accept')}
                                  sx={{ borderRadius: 999, boxShadow: 'none' }}
                                >
                                  同意
                                </Button>
                              </Stack>
                            ) : (
                              <Typography variant="caption" sx={{ color: alpha('#4d2d21', 0.56) }}>
                                {request.respondedAt ? `处理时间 ${formatTime(request.respondedAt)}` : '等待对方处理'}
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: alpha('#4d2d21', 0.65) }}>
                    暂时没有好友通知。
                  </Typography>
                )}
              </Stack>
            </Paper>

            {activeContact ? (
              <>
                <Stack
                  direction={{ xs: 'column', xl: 'row' }}
                  spacing={2}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <Stack direction="row" spacing={2.2} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Avatar
                      src={activeContact.avatarUrl ?? undefined}
                      alt={activeContact.username}
                      sx={{
                        width: { xs: 84, md: 112 },
                        height: { xs: 84, md: 112 },
                        boxShadow: `0 18px 40px ${alpha('#8c5336', 0.22)}`,
                      }}
                    >
                      {activeContact.username.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, minWidth: 0 }}
                      >
                        <Typography
                          variant="h4"
                          sx={{
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            color: '#231510',
                          }}
                          noWrap
                        >
                          {getContactLabel(activeContact)}
                        </Typography>
                        <Chip
                          size="small"
                          label={activeContact.isOnline ? '在线' : '离线'}
                          color={activeContact.isOnline ? 'success' : 'default'}
                          sx={{ borderRadius: 2 }}
                        />
                      </Stack>
                      <Typography variant="body1" sx={{ mt: 0.65, color: alpha('#513022', 0.8) }}>
                        @{activeContact.username}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, color: alpha('#513022', 0.72) }}>
                        {activeContact.isFriend
                          ? '已互为联系人，可以直接继续发送消息。'
                          : '当前仍是单向联系人，对方也添加你之后才允许继续发送新消息。'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      flexWrap: 'wrap',
                      alignSelf: { xs: 'flex-start', xl: 'center' },
                      justifyContent: { xl: 'flex-end' },
                    }}
                  >
                    <Chip
                      icon={<GroupRoundedIcon />}
                      label={activeContact.isFriend ? '互为联系人' : '等待互加'}
                      sx={{ backgroundColor: alpha('#fff', 0.28) }}
                    />
                    <Chip
                      icon={<PushPinRoundedIcon />}
                      label={activeContact.isPinned ? '已置顶' : '普通联系人'}
                      sx={{ backgroundColor: alpha('#fff', 0.2) }}
                    />
                    <Chip
                      icon={<ScheduleRoundedIcon />}
                      label={formatLastSeen(activeContact.isOnline, activeContact.lastSeenAt)}
                      sx={{ backgroundColor: alpha('#fff', 0.2) }}
                    />
                  </Stack>
                </Stack>

                <Divider sx={{ borderColor: alpha('#6e3a25', 0.1) }} />

                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(4, minmax(0, 1fr))',
                    },
                  }}
                >
                  {[
                    {
                      icon: <GroupRoundedIcon fontSize="small" />,
                      label: '联系人状态',
                      value: activeContact.isFriend ? '已互加' : '待对方同意',
                    },
                    {
                      icon: <AlternateEmailRoundedIcon fontSize="small" />,
                      label: '会话状态',
                      value: activeContact.conversationId || activeConversation ? '已有会话' : '尚未开启',
                    },
                    {
                      icon: <ScheduleRoundedIcon fontSize="small" />,
                      label: '添加时间',
                      value: formatCreatedDate(activeContact.createdAt),
                    },
                    {
                      icon: <StarBorderRoundedIcon fontSize="small" />,
                      label: '列表位置',
                      value: activeContact.isPinned ? '置顶区' : activeContact.isOnline ? '在线区' : '常规区',
                    },
                  ].map((item) => (
                    <Paper
                      key={item.label}
                      elevation={0}
                      sx={{
                        px: 1.5,
                        py: 1.35,
                        borderRadius: 3,
                        backgroundColor: alpha('#fff', 0.2),
                        border: `1px solid ${alpha('#6e3a25', 0.08)}`,
                      }}
                    >
                      <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', color: alpha('#5c3425', 0.65) }}>
                        {item.icon}
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {item.label}
                        </Typography>
                      </Stack>
                      <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 700, color: '#291711' }}>
                        {item.value}
                      </Typography>
                    </Paper>
                  ))}
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: '1fr',
                      xl: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
                    },
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 1.6, md: 2 },
                      borderRadius: 4,
                      backgroundColor: alpha('#fff', 0.18),
                      border: `1px solid ${alpha('#6e3a25', 0.08)}`,
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#241611' }}>
                        联系人信息
                      </Typography>
                      {[
                        ['显示名称', getContactLabel(activeContact)],
                        ['用户名', `@${activeContact.username}`],
                        ['最近在线', formatLastSeen(activeContact.isOnline, activeContact.lastSeenAt)],
                        ['当前备注', activeContact.alias?.trim() || '未设置备注'],
                      ].map(([label, value], index, rows) => (
                        <Box key={label}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={0.6}
                            sx={{
                              justifyContent: 'space-between',
                              alignItems: { xs: 'flex-start', sm: 'center' },
                              py: 0.8,
                            }}
                          >
                            <Typography variant="body2" sx={{ color: alpha('#4d2d21', 0.62) }}>
                              {label}
                            </Typography>
                            <Typography
                              variant="body1"
                              sx={{ fontWeight: 600, color: '#2c1913', textAlign: { sm: 'right' } }}
                            >
                              {value}
                            </Typography>
                          </Stack>
                          {index < rows.length - 1 && <Divider sx={{ borderColor: alpha('#6e3a25', 0.08) }} />}
                        </Box>
                      ))}
                    </Stack>
                  </Paper>

                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 1.6, md: 2 },
                      borderRadius: 4,
                      backgroundColor: alpha('#fff', 0.18),
                      border: `1px solid ${alpha('#6e3a25', 0.08)}`,
                    }}
                  >
                    <Stack spacing={1.35}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#241611' }}>
                        最近沟通
                      </Typography>
                      {activeConversation ? (
                        <>
                          <Typography variant="body2" sx={{ color: alpha('#4d2d21', 0.65) }}>
                            {activeConversation.lastMessageAt
                              ? `${formatTime(activeConversation.lastMessageAt)} · 最近一条消息`
                              : '已建立会话，暂时还没有消息'}
                          </Typography>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1.4,
                              borderRadius: 3,
                              backgroundColor: alpha('#fff', 0.3),
                              color: '#2b1812',
                            }}
                          >
                            <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                              {activeConversation.lastMessagePreview || '还没有发送过消息。'}
                            </Typography>
                          </Paper>
                          <Button
                            variant="contained"
                            startIcon={<ChatRoundedIcon />}
                            onClick={() => void openConversation(activeContact)}
                            sx={{
                              alignSelf: 'flex-start',
                              borderRadius: 999,
                              px: 2.2,
                              backgroundColor: '#ef8b78',
                              color: '#2b140e',
                              boxShadow: 'none',
                            }}
                          >
                            {activeContact.isFriend ? '发消息' : '查看会话'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Typography variant="body2" sx={{ color: alpha('#4d2d21', 0.65), lineHeight: 1.8 }}>
                            还没有和这位联系人建立会话。若双方已互加，可以直接开始一段新聊天。
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<ChatBubbleOutlineRoundedIcon />}
                            disabled={!activeContact.isFriend}
                            onClick={() => void openConversation(activeContact)}
                            sx={{
                              alignSelf: 'flex-start',
                              borderRadius: 999,
                              px: 2.2,
                              borderColor: alpha('#6e3a25', 0.18),
                              color: '#412116',
                            }}
                          >
                            开始聊天
                          </Button>
                        </>
                      )}

                      {alternateRecentConversations.length > 0 && (
                        <>
                          <Divider sx={{ borderColor: alpha('#6e3a25', 0.08) }} />
                          <Stack spacing={0.9}>
                            {alternateRecentConversations.map((conversation) => (
                              <Button
                                key={conversation.conversationId}
                                onClick={() => void openConversationById(conversation.conversationId)}
                                sx={{
                                  justifyContent: 'space-between',
                                  px: 1.1,
                                  py: 0.9,
                                  borderRadius: 3,
                                  textTransform: 'none',
                                  color: '#392219',
                                  backgroundColor: alpha('#fff', 0.16),
                                }}
                              >
                                <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                  <Typography noWrap sx={{ fontWeight: 700 }}>
                                    {conversation.peer.alias || conversation.peer.username}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: alpha('#4d2d21', 0.62) }} noWrap>
                                    {conversation.lastMessagePreview || '暂无消息'}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ color: alpha('#4d2d21', 0.56), ml: 1 }}>
                                  {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : '--'}
                                </Typography>
                              </Button>
                            ))}
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </Paper>
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 1.6, md: 2 },
                    borderRadius: 4,
                    backgroundColor: alpha('#fff7f4', 0.78),
                    border: `1px solid ${alpha('#6e3a25', 0.08)}`,
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
                    >
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#241611' }}>
                          推荐添加
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.35, color: alpha('#4d2d21', 0.66) }}>
                          这里展示当前还不是联系人的用户，可直接搜索、查看状态并发起好友申请。
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SearchRoundedIcon />}
                          onClick={() => void reloadAvailableUsers(0)}
                          disabled={messageStore.searchingUsers}
                          sx={{ borderRadius: 999, whiteSpace: 'nowrap' }}
                        >
                          {messageStore.searchingUsers ? '搜索中...' : '搜索'}
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<RefreshRoundedIcon />}
                          onClick={() => void handleNextBatch()}
                          disabled={messageStore.searchingUsers}
                          sx={{ whiteSpace: 'nowrap', color: '#512b1d' }}
                        >
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
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          backgroundColor: alpha('#fff', 0.9),
                        },
                      }}
                    />

                    <Paper
                      elevation={0}
                      sx={{
                        display: 'inline-flex',
                        alignSelf: 'flex-start',
                        p: 0.45,
                        borderRadius: 3,
                        backgroundColor: alpha('#f3ebe8', 0.96),
                        border: `1px solid ${alpha('#ccb2a8', 0.6)}`,
                      }}
                    >
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                        {[
                          { key: 'recommended', label: '推荐' },
                          { key: 'online', label: '在线' },
                          { key: 'pending', label: '待处理' },
                        ].map((item) => {
                          const active = availableUserMode === item.key;
                          return (
                            <Button
                              key={item.key}
                              size="small"
                              variant="text"
                              onClick={() => setAvailableUserMode(item.key as 'recommended' | 'online' | 'pending')}
                              sx={{
                                minWidth: 72,
                                px: 1.8,
                                py: 0.7,
                                borderRadius: 2.2,
                                color: active ? '#3a2018' : alpha('#6f4f44', 0.88),
                                backgroundColor: active ? alpha('#fff', 0.94) : 'transparent',
                                fontWeight: active ? 800 : 700,
                                boxShadow: active ? `0 4px 14px ${alpha('#7b4c39', 0.1)}` : 'none',
                                '&:hover': {
                                  backgroundColor: active ? alpha('#fff', 0.98) : alpha('#fff', 0.5),
                                },
                              }}
                            >
                              {item.label}
                            </Button>
                          );
                        })}
                      </Stack>
                    </Paper>

                    {filteredAvailableUsers.length > 0 ? (
                      <Paper
                        elevation={0}
                        sx={{
                          borderRadius: 3.5,
                          overflow: 'hidden',
                          backgroundColor: alpha('#fff', 0.62),
                          border: `1px solid ${alpha('#d7c2ba', 0.68)}`,
                        }}
                      >
                        <Stack divider={<Divider sx={{ borderColor: alpha('#6e3a25', 0.08) }} />}>
                          {filteredAvailableUsers.slice(0, 8).map((user) => {
                            const isIncomingPending = user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'incoming';
                            const isOutgoingPending = user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'outgoing';
                            const actionLabel = isIncomingPending ? '处理' : isOutgoingPending ? '已申请' : '加入';

                            return (
                              <Box
                                key={user.id}
                                sx={{
                                  px: { xs: 1.2, md: 1.6 },
                                  py: { xs: 1.25, md: 1.5 },
                                  backgroundColor: alpha('#fff', 0.45),
                                }}
                              >
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  spacing={1.35}
                                  sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                                >
                                  <Stack direction="row" spacing={1.4} sx={{ minWidth: 0, flex: 1 }}>
                                    <Avatar src={user.avatarUrl ?? undefined} alt={user.username} sx={{ width: 52, height: 52 }}>
                                      {user.username.slice(0, 1).toUpperCase()}
                                    </Avatar>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#2a1812' }} noWrap>
                                        {user.alias || user.username}
                                      </Typography>
                                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.6, flexWrap: 'wrap', rowGap: 0.7 }}>
                                        <Chip
                                          size="small"
                                          variant="outlined"
                                          label={`@${user.username}`}
                                          sx={{ backgroundColor: alpha('#fff', 0.7) }}
                                        />
                                        <Chip
                                          size="small"
                                          variant="outlined"
                                          label={user.isOnline ? '在线' : '最近活跃'}
                                          color={user.isOnline ? 'success' : 'default'}
                                          sx={{ backgroundColor: alpha('#fff', 0.7) }}
                                        />
                                        {user.friendRequestStatus === 'pending' && (
                                          <Chip
                                            size="small"
                                            color={isIncomingPending ? 'warning' : 'info'}
                                            label={isIncomingPending ? '待你处理' : '等待验证'}
                                            sx={{ backgroundColor: alpha('#fff', 0.7) }}
                                          />
                                        )}
                                        <Chip
                                          size="small"
                                          variant="outlined"
                                          label={formatLastSeen(user.isOnline, user.lastSeenAt)}
                                          sx={{ backgroundColor: alpha('#fff', 0.7) }}
                                        />
                                      </Stack>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          mt: 0.95,
                                          color: alpha('#533327', 0.74),
                                          lineHeight: 1.7,
                                          display: '-webkit-box',
                                          overflow: 'hidden',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                        }}
                                      >
                                        {buildSuggestedUserSummary(user, authStore.username)}
                                      </Typography>
                                    </Box>
                                  </Stack>

                                  <Button
                                    variant="outlined"
                                    disabled={isOutgoingPending}
                                    onClick={() => openCreateContactDialogForUser(user)}
                                    sx={{
                                      alignSelf: { xs: 'flex-end', sm: 'center' },
                                      minWidth: 112,
                                      px: 2.6,
                                      py: 1,
                                      borderRadius: 999,
                                      borderColor: alpha('#bca49a', 0.9),
                                      color: '#2f1811',
                                      backgroundColor: alpha('#fff', 0.78),
                                      fontWeight: 700,
                                      '&:hover': {
                                        borderColor: alpha('#9d7a6a', 0.9),
                                        backgroundColor: alpha('#fff', 0.94),
                                      },
                                    }}
                                  >
                                    {actionLabel}
                                  </Button>
                                </Stack>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Paper>
                    ) : (
                      <Typography variant="body2" sx={{ color: alpha('#4d2d21', 0.65) }}>
                        {messageStore.searchingUsers
                          ? '推荐用户加载中...'
                          : availableUserMode === 'pending'
                            ? '当前没有待处理的好友申请用户。'
                            : userKeyword.trim()
                              ? '没有找到符合条件的可添加用户。'
                              : '当前没有可添加的非联系人用户。'}
                      </Typography>
                    )}
                  </Stack>
                </Paper>

                <Stack
                  direction={{ xs: 'column-reverse', sm: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'flex-end' }}
                >
                  <Button
                    color="error"
                    variant="text"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={() => confirmDeleteContact(activeContact.contactUserId, getContactLabel(activeContact))}
                  >
                    删除联系人
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => openEditContactDialog(activeContact.contactUserId)}
                    sx={{
                      borderRadius: 999,
                      borderColor: alpha('#6e3a25', 0.18),
                      color: '#412116',
                    }}
                  >
                    编辑资料
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<ChatRoundedIcon />}
                    disabled={!activeContact.isFriend && !activeContact.conversationId}
                    onClick={() => void openConversation(activeContact)}
                    sx={{
                      borderRadius: 999,
                      px: 2.6,
                      backgroundColor: '#ef8b78',
                      color: '#2b140e',
                      boxShadow: 'none',
                    }}
                  >
                    {activeContact.isFriend ? '发消息' : (activeContact.conversationId ? '查看会话' : '待对方同意')}
                  </Button>
                </Stack>
              </>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  p: 4,
                  borderRadius: 5,
                  backgroundColor: alpha('#fff', 0.18),
                  border: `1px solid ${alpha('#6e3a25', 0.08)}`,
                }}
              >
                <Avatar
                  sx={{
                    width: 72,
                    height: 72,
                    mb: 2,
                    backgroundColor: alpha(theme.palette.primary.main, 0.16),
                    color: theme.palette.primary.main,
                  }}
                >
                  <GroupRoundedIcon />
                </Avatar>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#241611' }}>
                  先选择一个联系人
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, maxWidth: 420, color: alpha('#4d2d21', 0.68), lineHeight: 1.8 }}>
                  左侧列表会展示你当前的联系人。没有联系人时，可以直接从推荐用户里添加，或者打开好友管理器搜索用户。
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.5 }}>
                  <Button variant="contained" startIcon={<PersonAddRoundedIcon />} onClick={() => void openCreateContactDialog()}>
                    新增联系人
                  </Button>
                  <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void reloadAvailableUsers(0)}>
                    刷新推荐
                  </Button>
                </Stack>
              </Paper>
            )}
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
