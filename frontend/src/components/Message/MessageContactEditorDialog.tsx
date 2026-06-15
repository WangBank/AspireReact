import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { MessageUserSummary } from '../../services/MessageService';
import { formatLastSeen } from './messageFormatters';

interface MessageContactEditorDialogProps {
  open: boolean;
  editingContactUserId: number | null;
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  onSearchUsers: () => void | Promise<void>;
  onNextBatch?: () => void | Promise<void>;
  searchingUsers: boolean;
  userSearchResults: MessageUserSummary[];
  selectedContactUserId: number | null;
  onSelectUser: (user: MessageUserSummary) => void;
  selectedContactPreview: MessageUserSummary | null;
  requestMessage: string;
  onRequestMessageChange: (value: string) => void;
  alias: string;
  onAliasChange: (value: string) => void;
  pinned: boolean;
  onPinnedChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  saving: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
}

const MessageContactEditorDialog = ({
  open,
  editingContactUserId,
  searchKeyword,
  onSearchKeywordChange,
  onSearchUsers,
  onNextBatch,
  searchingUsers,
  userSearchResults,
  selectedContactUserId,
  onSelectUser,
  selectedContactPreview,
  requestMessage,
  onRequestMessageChange,
  alias,
  onAliasChange,
  pinned,
  onPinnedChange,
  onClose,
  onSubmit,
  saving,
  submitLabel,
  submitDisabled,
}: MessageContactEditorDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isEditing = editingContactUserId != null;
  const trimmedSearchKeyword = searchKeyword.trim();
  const isRecommendationMode = !isEditing && trimmedSearchKeyword.length === 0;
  const displayUsers = isRecommendationMode
    ? userSearchResults.filter((user) => !user.isContact)
    : userSearchResults;
  const selectedRequestStatus = selectedContactPreview?.friendRequestStatus ?? null;
  const selectedRequestDirection = selectedContactPreview?.friendRequestDirection ?? null;
  const isIncomingPending = !isEditing
    && selectedRequestStatus === 'pending'
    && selectedRequestDirection === 'incoming';
  const isOutgoingPending = !isEditing
    && selectedRequestStatus === 'pending'
    && selectedRequestDirection === 'outgoing';
  const finalSubmitLabel = submitLabel ?? (isEditing ? '保存' : '发送申请');
  const finalSubmitDisabled = submitDisabled ?? (!selectedContactUserId || saving || isOutgoingPending);
  const cardBackground = alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.68 : 0.88);
  const mutedTextColor = alpha(theme.palette.text.primary, 0.64);
  const sectionTitleColor = alpha(theme.palette.text.primary, 0.56);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 4,
            backgroundImage: 'none',
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.default, 0.96)
              : '#f9ece7',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            boxShadow: theme.palette.mode === 'dark'
              ? `0 24px 60px ${alpha('#000', 0.42)}`
              : '0 30px 80px rgba(124, 77, 49, 0.2)',
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.25, textAlign: 'center', fontWeight: 800 }}>
        {isEditing ? '编辑联系人' : '申请加好友'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.2}>
          {!isEditing && (
            <>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 1.75 },
                  borderRadius: 3.5,
                  backgroundColor: cardBackground,
                  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                }}
              >
                <Stack spacing={1.4}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: sectionTitleColor }}>
                    选择联系人
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      fullWidth
                      label="搜索用户"
                      placeholder="输入用户名或邮箱"
                      value={searchKeyword}
                      onChange={(event) => onSearchKeywordChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          onSearchUsers();
                        }
                      }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start" sx={{ mr: 0.2 }}>
                              <SearchRoundedIcon sx={{ color: mutedTextColor }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          backgroundColor: alpha(theme.palette.background.paper, 0.52),
                        },
                      }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => onSearchUsers()}
                      disabled={searchingUsers}
                      sx={{ minWidth: { sm: 104 }, borderRadius: 3 }}
                    >
                      {searchingUsers ? '搜索中...' : '搜索'}
                    </Button>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                  >
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        color={isRecommendationMode ? 'primary' : 'default'}
                        label={isRecommendationMode ? '推荐联系人' : '搜索结果'}
                      />
                      <Chip size="small" variant="outlined" label={`${displayUsers.length} 人`} />
                    </Stack>
                    {onNextBatch && (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => onNextBatch()}
                        disabled={searchingUsers}
                        sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}
                      >
                        换一批
                      </Button>
                    )}
                  </Stack>

                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      maxHeight: 240,
                      overflowY: 'auto',
                      backgroundColor: alpha(theme.palette.background.paper, 0.58),
                    }}
                  >
                    <List disablePadding>
                      {displayUsers.map((user, index) => (
                        <Box key={user.id}>
                          <ListItemButton
                            selected={selectedContactUserId === user.id}
                            onClick={() => onSelectUser(user)}
                            sx={{ px: 1.5, py: 1.25 }}
                          >
                            <Avatar src={user.avatarUrl ?? undefined} alt={user.username}>
                              {user.username.slice(0, 1).toUpperCase()}
                            </Avatar>
                            <ListItemText
                              sx={{ ml: 1.25 }}
                              primary={(
                                <Typography sx={{ fontWeight: 700 }}>
                                  {user.alias || user.username}
                                </Typography>
                              )}
                              secondary={(
                                <Typography variant="caption" color="text.secondary">
                                  {formatLastSeen(user.isOnline, user.lastSeenAt)}
                                </Typography>
                              )}
                            />
                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'incoming' && (
                                <Chip size="small" color="success" label="待你处理" />
                              )}
                              {user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'outgoing' && (
                                <Chip size="small" color="warning" label="已申请" />
                              )}
                              {user.isContact && <Chip size="small" label="已是联系人" />}
                            </Stack>
                          </ListItemButton>
                          {index < displayUsers.length - 1 && <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.06) }} />}
                        </Box>
                      ))}
                      {displayUsers.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                          {isRecommendationMode ? '当前没有可推荐的联系人，点击“换一批”试试。' : '没有匹配的用户，换个关键词再试。'}
                        </Typography>
                      )}
                    </List>
                  </Paper>
                </Stack>
              </Paper>

              {selectedContactPreview && (
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 3.5,
                    px: { xs: 1.6, sm: 2 },
                    py: 1.75,
                    backgroundColor: alpha(theme.palette.background.paper, 0.62),
                  }}
                >
                  <Stack spacing={1.35}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Avatar
                        src={selectedContactPreview.avatarUrl ?? undefined}
                        alt={selectedContactPreview.username}
                        sx={{ width: 58, height: 58 }}
                      >
                        {selectedContactPreview.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
                          {selectedContactPreview.alias || selectedContactPreview.username}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.35, color: mutedTextColor }}>
                          {selectedContactPreview.username}
                        </Typography>
                        <Typography variant="caption" sx={{ mt: 0.65, display: 'block', color: mutedTextColor }}>
                          {formatLastSeen(selectedContactPreview.isOnline, selectedContactPreview.lastSeenAt)}
                        </Typography>
                      </Box>
                      {selectedContactPreview.isContact && <Chip size="small" label="已是联系人" />}
                    </Stack>
                    {isIncomingPending && (
                      <Typography variant="body2" color="success.main">
                        对方已经向你发起申请，提交后会直接同意并互加为好友。
                      </Typography>
                    )}
                    {isOutgoingPending && (
                      <Typography variant="body2" color="warning.main">
                        你已经发过申请了，等待对方验证即可。
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              )}
            </>
          )}

          {!isEditing && (
            <Box>
              <Typography variant="caption" sx={{ mb: 0.8, display: 'block', fontWeight: 700, color: sectionTitleColor }}>
                填写验证信息
              </Typography>
              <TextField
                fullWidth
                placeholder="填写一句话让对方更容易通过"
                value={requestMessage}
                onChange={(event) => onRequestMessageChange(event.target.value)}
                multiline
                minRows={4}
                helperText={isIncomingPending ? '当前会直接同意对方申请，这里的内容不会再发送。' : '最多 200 个字符'}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.background.paper, 0.58),
                  },
                }}
              />
            </Box>
          )}

          <Box>
            <Typography variant="caption" sx={{ mb: 0.8, display: 'block', fontWeight: 700, color: sectionTitleColor }}>
              {isEditing ? '备注名' : '备注'}
            </Typography>
            <TextField
              fullWidth
              placeholder={isEditing ? '可选，用于会话和联系人展示' : '通过后保存为你的联系人备注'}
              value={alias}
              onChange={(event) => onAliasChange(event.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  backgroundColor: alpha(theme.palette.background.paper, 0.58),
                },
              }}
            />
          </Box>
          {isEditing && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Button
                variant={pinned ? 'contained' : 'outlined'}
                startIcon={<PushPinRoundedIcon />}
                onClick={() => onPinnedChange(!pinned)}
              >
                {pinned ? '已置顶' : '设为置顶'}
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Button onClick={onClose} sx={{ minWidth: 100, borderRadius: 999 }}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={() => onSubmit()}
          disabled={finalSubmitDisabled}
          sx={{ minWidth: 120, borderRadius: 999, boxShadow: 'none' }}
        >
          {saving ? '提交中...' : finalSubmitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MessageContactEditorDialog;
