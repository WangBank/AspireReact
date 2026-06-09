import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface FilterToolbarProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

const FilterToolbar = ({
  title,
  description,
  actions,
  className,
  children,
}: FilterToolbarProps) => (
  <Paper
    className={className}
    elevation={0}
    sx={{
      mb: 2,
      px: { xs: 2, md: 2.5 },
      py: { xs: 2, md: 2.25 },
      borderRadius: 4,
    }}
  >
    <Stack spacing={2}>
      {(title || description || actions) ? (
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          spacing={1.5}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', xl: 'flex-start' },
          }}
        >
          <Stack spacing={0.8}>
            {title ? (
              typeof title === 'string'
                ? <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
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
            <Box sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', xl: 'flex-start' } }}>
              {actions}
            </Box>
          ) : null}
        </Stack>
      ) : null}

      {children}
    </Stack>
  </Paper>
);

export default FilterToolbar;
