import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MessageContactEditorDialog from '../components/Message/MessageContactEditorDialog';
import MessageDeleteContactDialog from '../components/Message/MessageDeleteContactDialog';
import { formatLastSeen, formatTime } from '../components/Message/messageFormatters';
import PageHeader from '../components/Page/PageHeader';
import RouteLoadingFallback from '../components/Page/RouteLoadingFallback';
import SectionCard from '../components/Page/SectionCard';
import type { MessageUserSummary } from '../services/MessageService';
import { useStore } from '../stores/StoreProvider';

const MessageContactsPage = observer(() => {
  const { messageStore } = useStore();
  const theme = useTheme();
  const navigate = useNavigate();
  const [contactKeyword, setContactKeyword] = useState('');
  const [userKeyword, setUserKeyword] = useState('');
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
  const [userSearchSkip, setUserSearchSkip] = useState(0);

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
      void messageStore.dispose();
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
  const recentConversations = useMemo(
    () => messageStore.conversations.slice(0, 5),
    [messageStore.conversations],
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

  const resetContactDialog = () => {
    setSelectedContactUserId(null);
    setSelectedContactPreview(null);
    setContactAlias('');
    setContactPinned(false);
    setEditingContactUserId(null);
    setContactSearchKeyword('');
  };

  const openCreateContactDialog = () => {
    resetContactDialog();
    setContactDialogOpen(true);
  };

  const openCreateContactDialogForUser = (user: MessageUserSummary) => {
    resetContactDialog();
    setSelectedContactUserId(user.id);
    setSelectedContactPreview(user);
    setContactAlias(user.alias ?? '');
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
      alias: contact.alias,
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
      } else {
        await messageStore.upsertContact(selectedContactUserId, contactAlias, contactPinned);
      }

      setContactDialogOpen(false);
      resetContactDialog();
      await reloadAvailableUsers();
    } finally {
      setContactSaving(false);
    }
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

  const openConversation = async (targetUserId: number) => {
    await messageStore.startDirectConversation(targetUserId);
    navigate('/messages');
  };

  if (messageStore.loading && messageStore.contacts.length === 0 && messageStore.conversations.length === 0) {
    return <RouteLoadingFallback label="联系人页面加载中..." minHeight={320} compact />;
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Contacts"
        title="联系人管理"
        subtitle="集中搜索平台用户、添加新联系人、维护备注和置顶，并可直接发起一对一会话。"
        actions={(
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button variant="outlined" startIcon={<ChatRoundedIcon />} onClick={() => navigate('/messages')}>
              返回消息
            </Button>
            <Button variant="contained" startIcon={<PersonAddRoundedIcon />} onClick={openCreateContactDialog}>
              新增联系人
            </Button>
          </Stack>
        )}
        stats={[
          { label: '联系人总数', value: messageStore.contacts.length },
          { label: '置顶联系人', value: pinnedContactCount },
          { label: '在线联系人', value: onlineContactCount },
          { label: '可添加用户', value: availableUsers.length },
        ]}
      />

      {messageStore.error && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={messageStore.clearError}>
          {messageStore.error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            xl: 'minmax(0, 1fr) minmax(0, 1fr)',
          },
        }}
      >
        <SectionCard
          title="搜索平台用户"
          description="默认展示当前不是好友的推荐用户，也可以按用户名或邮箱继续筛选。"
          actions={(
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => void reloadAvailableUsers(0)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              刷新结果
            </Button>
          )}
        >
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'minmax(0, 1fr) auto auto',
                },
                alignItems: 'stretch',
              }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="输入用户名或邮箱，留空时默认展示最多 20 个非好友用户"
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
              <Button
                variant="contained"
                startIcon={<SearchRoundedIcon />}
                onClick={() => void reloadAvailableUsers(0)}
                disabled={messageStore.searchingUsers}
                sx={{
                  minWidth: { md: 112 },
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {messageStore.searchingUsers ? '搜索中...' : '搜索'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<AutorenewRoundedIcon />}
                onClick={() => void handleNextBatch()}
                disabled={messageStore.searchingUsers}
                sx={{
                  minWidth: { md: 112 },
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                换一批
              </Button>
            </Box>

            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={1}
              sx={{ alignItems: { xs: 'stretch', lg: 'center' }, flexWrap: 'wrap' }}
            >
              <Chip
                color="primary"
                variant="outlined"
                label={messageStore.searchingUsers && availableUsers.length === 0
                  ? '推荐加载中...'
                  : `当前推荐 ${availableUsers.length} 人`}
                sx={{ alignSelf: { xs: 'flex-start', lg: 'center' } }}
              />
              {availableUsers.slice(0, 4).map((user) => (
                <Chip
                  key={`quick-${user.id}`}
                  avatar={<Avatar src={user.avatarUrl ?? undefined}>{user.username.slice(0, 1).toUpperCase()}</Avatar>}
                  label={user.username}
                  onClick={() => openCreateContactDialogForUser(user)}
                  variant="outlined"
                  sx={{
                    maxWidth: 220,
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  }}
                />
              ))}
            </Stack>

            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                p: 1.25,
                backgroundColor: alpha(theme.palette.background.default, 0.68),
                minHeight: 360,
              }}
            >
              <List disablePadding sx={{ maxHeight: 520, overflowY: 'auto' }}>
                {availableUsers.map((user) => {
                  return (
                    <ListItemButton
                      key={user.id}
                      sx={{
                        borderRadius: 3,
                        mb: 1,
                        alignItems: 'flex-start',
                        border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
                        px: 1.25,
                        py: 1.1,
                      }}
                      onClick={() => setSelectedContactPreview(user)}
                    >
                      <Avatar src={user.avatarUrl ?? undefined} alt={user.username}>
                        {user.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <ListItemText
                        sx={{ ml: 1.25, mr: 1 }}
                        primary={(
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                              {user.username}
                            </Typography>
                            {user.isOnline && <Chip size="small" color="success" label="在线" />}
                          </Stack>
                        )}
                        secondary={(
                          <Stack spacing={0.4} sx={{ mt: 0.45 }}>
                            <Typography variant="body2" color="text.secondary">
                              用户名：{user.username}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatLastSeen(user.isOnline, user.lastSeenAt)}
                            </Typography>
                          </Stack>
                        )}
                      />
                      <Stack spacing={0.8} sx={{ minWidth: { xs: 96, sm: 118 }, flexShrink: 0 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<ChatRoundedIcon />}
                          sx={{ whiteSpace: 'nowrap' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            void openConversation(user.id);
                          }}
                        >
                          发消息
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PersonAddRoundedIcon />}
                          sx={{ whiteSpace: 'nowrap' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            openCreateContactDialogForUser(user);
                          }}
                        >
                          添加
                        </Button>
                      </Stack>
                    </ListItemButton>
                  );
                })}
                {messageStore.searchingUsers && availableUsers.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
                    推荐用户加载中...
                  </Typography>
                )}
                {!messageStore.searchingUsers && availableUsers.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
                    {userKeyword.trim() ? '没有找到符合条件的可添加用户。' : '当前没有可添加的非好友用户。'}
                  </Typography>
                )}
              </List>
            </Paper>
          </Stack>
        </SectionCard>

        <SectionCard
          title="我的联系人"
          description="支持搜索、编辑、置顶、删除，并可直接进入消息页继续沟通。"
          actions={(
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => void messageStore.loadContacts(contactKeyword.trim())}
            >
              刷新联系人
            </Button>
          )}
        >
          <Stack spacing={2}>
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
                placeholder="搜索联系人或备注"
                value={contactKeyword}
                onChange={(event) => setContactKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void messageStore.loadContacts(contactKeyword.trim());
                  }
                }}
              />
              <Button
                variant="outlined"
                startIcon={<SearchRoundedIcon />}
                onClick={() => void messageStore.loadContacts(contactKeyword.trim())}
                sx={{
                  minWidth: { md: 112 },
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                搜索
              </Button>
            </Box>

            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                p: 1.25,
                backgroundColor: alpha(theme.palette.background.default, 0.68),
                minHeight: 360,
              }}
            >
              <List disablePadding sx={{ maxHeight: 520, overflowY: 'auto' }}>
                {messageStore.contacts.map((contact) => (
                  <ListItemButton
                    key={contact.contactUserId}
                    sx={{
                      borderRadius: 3,
                      mb: 1,
                      alignItems: 'flex-start',
                      border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
                      px: 1.25,
                      py: 1.1,
                    }}
                    onClick={() => void openConversation(contact.contactUserId)}
                  >
                    <Avatar src={contact.avatarUrl ?? undefined} alt={contact.username}>
                      {contact.username.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <ListItemText
                      sx={{ ml: 1.25, mr: 1 }}
                      primary={(
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                            {contact.alias || contact.username}
                          </Typography>
                          {contact.isOnline && <Chip size="small" color="success" label="在线" />}
                          {contact.isPinned && <Chip size="small" variant="outlined" label="置顶" />}
                        </Stack>
                      )}
                      secondary={(
                        <Stack spacing={0.4} sx={{ mt: 0.45 }}>
                          <Typography variant="body2" color="text.secondary">
                            用户名：{contact.username}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatLastSeen(contact.isOnline, contact.lastSeenAt)}
                          </Typography>
                        </Stack>
                      )}
                    />
                    <Stack spacing={0.8} sx={{ minWidth: { xs: 96, sm: 118 }, flexShrink: 0 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ChatRoundedIcon />}
                        sx={{ whiteSpace: 'nowrap' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          void openConversation(contact.contactUserId);
                        }}
                      >
                        发消息
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ whiteSpace: 'nowrap' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditContactDialog(contact.contactUserId);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        onClick={(event) => {
                          event.stopPropagation();
                          confirmDeleteContact(contact.contactUserId, contact.alias || contact.username);
                        }}
                      >
                        删除
                      </Button>
                    </Stack>
                  </ListItemButton>
                ))}
                {messageStore.contacts.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
                    暂无联系人。
                  </Typography>
                )}
              </List>
            </Paper>
          </Stack>
        </SectionCard>
      </Box>

      {recentConversations.length > 0 && (
        <SectionCard
          title="最近沟通"
          description="优先展示最近活跃的会话，方便直接继续聊天。"
        >
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {recentConversations.map((conversation) => (
              <Paper
                key={conversation.conversationId}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  p: 1.25,
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Avatar src={conversation.peer.avatarUrl ?? undefined} alt={conversation.peer.username}>
                      {conversation.peer.username.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                        {conversation.peer.alias || conversation.peer.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : '暂无消息'}
                      </Typography>
                    </Box>
                    {conversation.isPinned && <Chip size="small" variant="outlined" label="置顶" />}
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 42 }}>
                    {conversation.lastMessagePreview || '还没有发送过消息'}
                  </Typography>

                  <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<ChatRoundedIcon />}
                      sx={{ whiteSpace: 'nowrap' }}
                      onClick={() => void openConversation(conversation.peer.id)}
                    >
                      继续聊天
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Box>
        </SectionCard>
      )}

      <MessageContactEditorDialog
        open={contactDialogOpen}
        editingContactUserId={editingContactUserId}
        searchKeyword={contactSearchKeyword}
        onSearchKeywordChange={setContactSearchKeyword}
        onSearchUsers={() => void messageStore.searchUsers(contactSearchKeyword)}
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
          void reloadAvailableUsers();
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
    </Box>
  );
});

export default MessageContactsPage;
