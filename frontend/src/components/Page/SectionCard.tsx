import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';

interface SectionCardProps {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

const baseSectionCardSx: SxProps<Theme> = (theme) => ({
  mb: 3,
  px: { xs: 2, md: 3 },
  py: { xs: 2, md: 2.5 },
  borderRadius: 3,
  border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
  backgroundColor: alpha(theme.palette.background.paper, 0.96),
  boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}`,
});

const SectionCard = ({
  id,
  title,
  description,
  actions,
  footer,
  className,
  children,
  sx,
}: SectionCardProps) => {
  const resolvedSx = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <Paper
      component="section"
      id={id}
      className={className}
      elevation={0}
      sx={[baseSectionCardSx, ...resolvedSx]}
    >
      <Stack spacing={2}>
        {(title || description || actions) ? (
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', lg: 'flex-start' },
              pb: 1.5,
              borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.72)}`,
            }}
          >
            <Stack spacing={0.9} sx={{ minWidth: 0 }}>
              {title ? (
                typeof title === 'string'
                  ? <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
                  : title
              ) : null}
              {description ? (
                <Box sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.7 }}>
                  {typeof description === 'string'
                    ? <Typography variant="body2" color="inherit">{description}</Typography>
                    : description}
                </Box>
              ) : null}
            </Stack>
            {actions ? (
              <Box sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', lg: 'flex-start' } }}>
                {actions}
              </Box>
            ) : null}
          </Stack>
        ) : null}

        {children}

        {footer ? (
          <Box
            sx={{
              pt: 1.5,
              borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.72)}`,
            }}
          >
            {footer}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default SectionCard;
