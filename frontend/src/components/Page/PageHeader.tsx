import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

interface PageHeaderStat {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  stats?: PageHeaderStat[];
  className?: string;
}

const PageHeader = ({
  eyebrow,
  title,
  subtitle,
  actions,
  stats = [],
  className,
}: PageHeaderProps) => {
  const theme = useTheme();

  return (
    <Paper
      className={className}
      elevation={0}
      sx={{
        mb: 2.5,
        px: { xs: 2.25, md: 3 },
        py: { xs: 2.25, md: 3 },
        borderRadius: 4,
        background: [
          `radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.12)}, transparent 34%)`,
          `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha('#f8fafc', 0.94)})`,
        ].join(','),
      }}
    >
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', lg: 'flex-start' },
          }}
        >
          <Stack spacing={1.1} sx={{ minWidth: 0 }}>
            {eyebrow ? (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignSelf: 'flex-start',
                  px: 1.2,
                  py: 0.5,
                  borderRadius: 999,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow}
              </Box>
            ) : null}

            {typeof title === 'string' ? (
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                {title}
              </Typography>
            ) : (
              title
            )}

            {subtitle ? (
              <Box sx={{ color: 'text.secondary', maxWidth: 820, lineHeight: 1.7 }}>
                {typeof subtitle === 'string'
                  ? <Typography variant="body1">{subtitle}</Typography>
                  : subtitle}
              </Box>
            ) : null}
          </Stack>

          {actions ? (
            <Box sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', lg: 'flex-start' } }}>
              {actions}
            </Box>
          ) : null}
        </Stack>

        {stats.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                sm: `repeat(${Math.min(2, stats.length)}, minmax(0, 1fr))`,
                lg: `repeat(${Math.min(4, stats.length)}, minmax(0, 1fr))`,
              },
            }}
          >
            {stats.map((stat) => (
              <Paper
                key={stat.label}
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.6,
                  borderRadius: 3,
                  backgroundColor: alpha(theme.palette.background.paper, 0.82),
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    mb: 0.75,
                  }}
                >
                  {stat.label}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {stat.value}
                </Typography>
                {stat.helper ? (
                  <Box sx={{ mt: 0.65, color: 'text.secondary', fontSize: 13 }}>
                    {stat.helper}
                  </Box>
                ) : null}
              </Paper>
            ))}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default PageHeader;
