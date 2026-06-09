import { alpha, createTheme, responsiveFontSizes } from '@mui/material/styles';

const baseTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0969da',
      light: '#2f81f7',
      dark: '#0550ae',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8250df',
      light: '#a475f9',
      dark: '#6639ba',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f4f7fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2328',
      secondary: '#57606a',
    },
    divider: '#d0d7de',
    success: {
      main: '#1a7f37',
    },
    warning: {
      main: '#9a6700',
    },
    error: {
      main: '#cf222e',
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 700,
    },
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
      letterSpacing: 0,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'light',
          fontFamily: '"IBM Plex Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          '--app-bg': '#f4f7fb',
          '--app-surface': '#ffffff',
          '--app-surface-muted': '#f8fafc',
          '--app-surface-accent': '#eef6ff',
          '--app-border': '#d0d7de',
          '--app-border-muted': '#d8dee4',
          '--app-text': '#1f2328',
          '--app-text-muted': '#57606a',
          '--app-text-subtle': '#6e7781',
          '--app-accent': '#0969da',
          '--app-accent-strong': '#0550ae',
          '--app-accent-muted': '#ddf4ff',
          '--app-success': '#1a7f37',
          '--app-success-muted': '#dafbe1',
          '--app-danger': '#cf222e',
          '--app-danger-muted': '#ffebe9',
          '--app-warning': '#9a6700',
          '--app-warning-muted': '#fff8c5',
          '--app-shadow-sm': '0 1px 2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(208, 215, 222, 0.35)',
          '--app-shadow-md': '0 16px 40px rgba(15, 23, 42, 0.10)',
          '--app-shadow-lg': '0 24px 54px rgba(15, 23, 42, 0.12)',
          '--app-radius-sm': '10px',
          '--app-radius-md': '16px',
          '--app-radius-lg': '22px',
          '--app-navbar-height': '72px',
        },
        html: {
          minHeight: '100%',
          scrollBehavior: 'smooth',
        },
        body: {
          minHeight: '100vh',
          backgroundColor: '#f4f7fb',
          backgroundImage: [
            `radial-gradient(circle at top left, ${alpha('#0969da', 0.1)}, transparent 26%)`,
            `radial-gradient(circle at top right, ${alpha('#8250df', 0.08)}, transparent 20%)`,
            'linear-gradient(180deg, #f7faff 0%, #f4f7fb 48%, #eef2f7 100%)',
          ].join(','),
          color: '#1f2328',
        },
        '#root': {
          minHeight: '100vh',
        },
        '::-webkit-scrollbar': {
          width: '10px',
          height: '10px',
        },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: alpha('#8c959f', 0.65),
          borderRadius: '999px',
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
        },
        '::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        'input[type="checkbox"], input[type="radio"]': {
          accentColor: '#0969da',
        },
        code: {
          fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(208, 215, 222, 0.8)',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(208, 215, 222, 0.85)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 16,
          minHeight: 40,
        },
        contained: {
          boxShadow: '0 8px 20px rgba(9, 105, 218, 0.16)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: alpha('#ffffff', 0.88),
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#0969da', 0.45),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
          },
        },
        input: {
          paddingTop: 13,
          paddingBottom: 13,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          borderBottom: '1px solid rgba(208, 215, 222, 0.72)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: '#57606a',
          backgroundColor: '#f8fafc',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 22,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
  },
});

export const appTheme = responsiveFontSizes(baseTheme);
