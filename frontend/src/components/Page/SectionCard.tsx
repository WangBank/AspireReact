import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

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

const SectionCard = ({
  id,
  title,
  description,
  actions,
  footer,
  className,
  children,
  sx,
}: SectionCardProps) => (
  <Paper
    component="section"
    id={id}
    className={className}
    elevation={0}
    sx={{
      mb: 3,
      px: { xs: 2, md: 3 },
      py: { xs: 2, md: 2.5 },
      borderRadius: 4,
      ...sx,
    }}
  >
    <Stack spacing={2}>
      {(title || description || actions) ? (
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', lg: 'flex-start' },
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

      {footer ? <Box>{footer}</Box> : null}
    </Stack>
  </Paper>
);

export default SectionCard;
