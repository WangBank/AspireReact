import { CircularProgress, Paper, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface RouteLoadingFallbackProps {
  label?: string;
  minHeight?: number | string;
  compact?: boolean;
  sx?: SxProps<Theme>;
}

const RouteLoadingFallback = ({
  label = '页面加载中...',
  minHeight = '52vh',
  compact = false,
  sx,
}: RouteLoadingFallbackProps) => (
  <Stack
    sx={{
      minHeight,
      width: '100%',
      px: 2,
      alignItems: 'center',
      justifyContent: 'center',
      ...sx,
    }}
  >
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: compact ? 360 : 420,
        px: compact ? 2.5 : 3,
        py: compact ? 2.5 : 3.5,
        borderRadius: 4,
      }}
    >
      <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
        <CircularProgress size={compact ? 24 : 30} thickness={4.6} />
        <Typography variant={compact ? 'body2' : 'body1'} color="text.secondary">
          {label}
        </Typography>
      </Stack>
    </Paper>
  </Stack>
);

export default RouteLoadingFallback;
