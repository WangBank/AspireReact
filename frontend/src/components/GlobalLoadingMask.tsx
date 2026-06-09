import { useEffect, useState, useSyncExternalStore } from 'react';
import { alpha } from '@mui/material/styles';
import { Backdrop, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { networkActivity } from '../utils/networkActivity';

const GlobalLoadingMask = () => {
  const activeRequestCount = useSyncExternalStore(
    networkActivity.subscribe,
    networkActivity.getSnapshot,
    networkActivity.getSnapshot,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activeRequestCount <= 0) {
      setVisible(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeRequestCount]);

  if (!visible) {
    return null;
  }

  return (
    <Backdrop
      open
      aria-live="polite"
      aria-busy="true"
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 10,
        backgroundColor: alpha('#0f172a', 0.24),
        backdropFilter: 'blur(6px)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          px: 2.25,
          py: 1.8,
          borderRadius: 4,
          minWidth: 220,
        }}
      >
        <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
          <CircularProgress size={26} thickness={4.6} />
          <Stack spacing={0.35}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              正在同步数据
            </Typography>
            <Typography variant="body2" color="text.secondary">
              请求处理中，请稍候…
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </Backdrop>
  );
};

export default GlobalLoadingMask;
