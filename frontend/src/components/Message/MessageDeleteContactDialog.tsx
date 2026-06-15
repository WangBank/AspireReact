import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

interface MessageDeleteContactDialogProps {
  open: boolean;
  label: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

const MessageDeleteContactDialog = ({
  open,
  label,
  deleting,
  onClose,
  onConfirm,
}: MessageDeleteContactDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>删除联系人</DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2" color="text.secondary">
        {`确定删除联系人“${label}”吗？删除后不会清空历史会话和消息。`}
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={deleting}>
        取消
      </Button>
      <Button color="error" variant="contained" onClick={() => onConfirm()} disabled={deleting}>
        {deleting ? '删除中...' : '确认删除'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default MessageDeleteContactDialog;
