import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import SectionCard from './SectionCard';

interface ResponsiveTableShellProps {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
  tableMinWidth?: number | string;
  sx?: SxProps<Theme>;
}

const ResponsiveTableShell = ({
  id,
  title,
  description,
  actions,
  toolbar,
  footer,
  className,
  children,
  tableMinWidth = 860,
  sx,
}: ResponsiveTableShellProps) => (
  <SectionCard
    id={id}
    title={title}
    description={description}
    actions={actions}
    footer={footer}
    className={className}
    sx={sx}
  >
    {toolbar}
    <Box
      sx={{
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        mx: { xs: -0.5, md: 0 },
        '& table': {
          width: '100%',
          minWidth: tableMinWidth,
        },
      }}
    >
      {children}
    </Box>
  </SectionCard>
);

export default ResponsiveTableShell;
