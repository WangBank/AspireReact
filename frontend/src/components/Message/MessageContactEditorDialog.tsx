import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { MessageUserSummary } from '../../services/MessageService';
import { formatLastSeen } from './messageFormatters';

interface MessageContactEditorDialogProps {
  open: boolean;
  editingContactUserId: number | null;
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  onSearchUsers: () => void | Promise<void>;
  searchingUsers: boolean;
  userSearchResults: MessageUserSummary[];
  selectedContactUserId: number | null;
  onSelectUser: (user: MessageUserSummary) => void;
  selectedContactPreview: MessageUserSummary | null;
  alias: string;
  onAliasChange: (value: string) => void;
  pinned: boolean;
  onPinnedChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  saving: boolean;
}

const MessageContactEditorDialog = ({
  open,
  editingContactUserId,
  searchKeyword,
  onSearchKeywordChange,
  onSearchUsers,
  searchingUsers,
  userSearchResults,
  selectedContactUserId,
  onSelectUser,
  selectedContactPreview,
  alias,
  onAliasChange,
  pinned,
  onPinnedChange,
  onClose,
  onSubmit,
  saving,
}: MessageContactEditorDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{editingContactUserId ? '编辑联系人' : '添加联系人'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {!editingContactUserId && (
            <>
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
                />
                <Button
                  variant="outlined"
                  onClick={() => onSearchUsers()}
                  disabled={searchingUsers}
                  sx={{ minWidth: { sm: 96 } }}
                >
                  {searchingUsers ? '搜索中...' : '搜索'}
                </Button>
              </Stack>

              <Paper variant="outlined" sx={{ borderRadius: 3, maxHeight: 280, overflowY: 'auto' }}>
                <List disablePadding>
                  {userSearchResults.map((user) => (
                    <ListItemButton
                      key={user.id}
                      selected={selectedContactUserId === user.id}
                      onClick={() => onSelectUser(user)}
                    >
                      <Avatar src={user.avatarUrl ?? undefined} alt={user.username}>
                        {user.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <ListItemText
                        sx={{ ml: 1.25 }}
                        primary={user.username}
                        secondary={formatLastSeen(user.isOnline, user.lastSeenAt)}
                      />
                      {user.isContact && <Chip size="small" label="已是联系人" />}
                    </ListItemButton>
                  ))}
                  {userSearchResults.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                      先搜索一个用户。
                    </Typography>
                  )}
                </List>
              </Paper>

              {selectedContactPreview && (
                <Paper variant="outlined" sx={{ borderRadius: 3, px: 1.25, py: 1 }}>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                    <Avatar src={selectedContactPreview.avatarUrl ?? undefined} alt={selectedContactPreview.username}>
                      {selectedContactPreview.username.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {selectedContactPreview.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatLastSeen(selectedContactPreview.isOnline, selectedContactPreview.lastSeenAt)}
                      </Typography>
                    </Box>
                    {selectedContactPreview.isContact && <Chip size="small" label="已是联系人" />}
                  </Stack>
                </Paper>
              )}
            </>
          )}

          <TextField
            label="备注名"
            placeholder="可选，用于会话和联系人展示"
            value={alias}
            onChange={(event) => onAliasChange(event.target.value)}
          />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button
              variant={pinned ? 'contained' : 'outlined'}
              startIcon={<PushPinRoundedIcon />}
              onClick={() => onPinnedChange(!pinned)}
            >
              {pinned ? '已置顶' : '设为置顶'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          取消
        </Button>
        <Button variant="contained" onClick={() => onSubmit()} disabled={!selectedContactUserId || saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MessageContactEditorDialog;
