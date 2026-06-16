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
  FormControlLabel,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
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
  const isRecommendationMode = !isEditing && searchKeyword.trim().length === 0;
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
            borderRadius: fullScreen ? 0 : 3,
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>
        {isEditing ? '编辑联系人' : '申请加好友'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {!isEditing && (
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="搜索用户"
                  placeholder="输入用户名或邮箱"
                  value={searchKeyword}
                  onChange={(event) => onSearchKeywordChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void onSearchUsers();
                    }
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => void onSearchUsers()}
                  disabled={searchingUsers}
                  sx={{ minWidth: { sm: 96 } }}
                >
                  {searchingUsers ? '搜索中' : '搜索'}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    color={isRecommendationMode ? 'primary' : 'default'}
                    label={isRecommendationMode ? '推荐用户' : '搜索结果'}
                  />
                  <Chip size="small" variant="outlined" label={`${displayUsers.length} 人`} />
                </Stack>
                {onNextBatch && (
                  <Button size="small" onClick={() => void onNextBatch()} disabled={searchingUsers}>
                    换一批
                  </Button>
                )}
              </Stack>

              <Paper variant="outlined" sx={{ borderRadius: 2, maxHeight: 240, overflowY: 'auto' }}>
                <List disablePadding>
                  {displayUsers.map((user, index) => (
                    <Box key={user.id}>
                      <ListItemButton
                        selected={selectedContactUserId === user.id}
                        onClick={() => onSelectUser(user)}
                        sx={{
                          px: 1.5,
                          py: 1.25,
                          '&.Mui-selected': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                          },
                          '&.Mui-selected:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.12),
                          },
                        }}
                      >
                        <Avatar src={user.avatarUrl ?? undefined} alt={user.username}>
                          {user.username.slice(0, 1).toUpperCase()}
                        </Avatar>
                        <ListItemText
                          sx={{ ml: 1.25 }}
                          primary={user.alias || user.username}
                          secondary={formatLastSeen(user.isOnline, user.lastSeenAt)}
                        />
                        <Stack direction="row" spacing={0.75}>
                          {user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'incoming' && (
                            <Chip size="small" color="success" label="待处理" />
                          )}
                          {user.friendRequestStatus === 'pending' && user.friendRequestDirection === 'outgoing' && (
                            <Chip size="small" color="warning" label="已申请" />
                          )}
                          {user.isContact && <Chip size="small" label="已是联系人" />}
                        </Stack>
                      </ListItemButton>
                      {index < displayUsers.length - 1 && <Divider />}
                    </Box>
                  ))}
                  {displayUsers.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                      {isRecommendationMode ? '暂无推荐用户，点“换一批”试试。' : '没有匹配的用户。'}
                    </Typography>
                  )}
                </List>
              </Paper>

              {selectedContactPreview && (
                <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Avatar
                      src={selectedContactPreview.avatarUrl ?? undefined}
                      alt={selectedContactPreview.username}
                      sx={{ width: 52, height: 52 }}
                    >
                      {selectedContactPreview.username.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {selectedContactPreview.alias || selectedContactPreview.username}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        @{selectedContactPreview.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatLastSeen(selectedContactPreview.isOnline, selectedContactPreview.lastSeenAt)}
                      </Typography>
                    </Box>
                    {selectedContactPreview.isContact && <Chip size="small" label="已是联系人" />}
                  </Stack>
                  {isIncomingPending && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      对方已向你发起申请，提交后会直接同意。
                    </Typography>
                  )}
                  {isOutgoingPending && (
                    <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                      你已经发过申请，等待对方处理。
                    </Typography>
                  )}
                </Paper>
              )}

              <TextField
                fullWidth
                label="验证信息"
                placeholder="填写一句话让对方更容易通过"
                value={requestMessage}
                onChange={(event) => onRequestMessageChange(event.target.value)}
                multiline
                minRows={3}
                helperText={isIncomingPending ? '当前会直接同意对方申请。' : '最多 200 个字符'}
              />
            </Stack>
          )}

          <TextField
            fullWidth
            label={isEditing ? '备注名' : '备注'}
            placeholder={isEditing ? '可选' : '通过后保存为联系人备注'}
            value={alias}
            onChange={(event) => onAliasChange(event.target.value)}
          />

          {isEditing && (
            <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.25 }}>
              <FormControlLabel
                control={(
                  <Switch
                    checked={pinned}
                    onChange={(_, checked) => onPinnedChange(checked)}
                  />
                )}
                label={(
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <PushPinRoundedIcon fontSize="small" />
                    <Typography variant="body2">{pinned ? '已置顶' : '设为置顶'}</Typography>
                  </Stack>
                )}
                sx={{ m: 0 }}
              />
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={() => void onSubmit()} disabled={finalSubmitDisabled}>
          {saving ? '提交中...' : finalSubmitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MessageContactEditorDialog;
