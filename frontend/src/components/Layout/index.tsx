import { useState, useCallback, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { useStore } from '../../stores/StoreProvider';

interface NavLinkItem {
  label: string;
  path: string;
}

const BASE_NAV_ITEMS: NavLinkItem[] = [
  { label: '首页', path: '/dashboard' },
  { label: '录入', path: '/entry/unified' },
  { label: '数据列表', path: '/list/unified' },
  { label: '统计', path: '/statistics' },
  { label: '全局笔记', path: '/notes/global' },
  { label: '心魔笔记', path: '/notes/stock' },
  { label: '吾日三省吾身', path: '/notes/reflection' },
];

const ADMIN_NAV_ITEMS: NavLinkItem[] = [
  { label: '管理员后台', path: '/admin' },
];

const QUICK_ENTRY_PATH = '/entry/unified';

const isStandaloneDisplayMode = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || ((window.navigator as Navigator & { standalone?: boolean }).standalone ?? false);

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isInstallPromptSupported = () => 'BeforeInstallPromptEvent' in window;

interface InstallGuideContent {
  title: string;
  description: string;
  steps: string[];
}

const Layout = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHint, setInstallHint] = useState('');
  const [installGuide, setInstallGuide] = useState<InstallGuideContent | null>(null);
  const [installCopyNotice, setInstallCopyNotice] = useState('');
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => isStandaloneDisplayMode());
  const [isIosInstallTarget] = useState(() => isIosDevice());

  const userMenuOpen = Boolean(userMenuAnchor);
  const homePath = authStore.isAdmin ? '/admin' : '/dashboard';
  const isEntryRoute = location.pathname.startsWith('/entry');
  const showTradingNavigation = !authStore.isAdmin;
  const showFloatingEntry = showTradingNavigation && !isEntryRoute;
  const showInstallAction = !isStandaloneApp;
  const navItems = authStore.isAdmin ? ADMIN_NAV_ITEMS : BASE_NAV_ITEMS;

  const closeUserMenu = useCallback(() => setUserMenuAnchor(null), []);

  const handleLogout = useCallback(() => {
    authStore.logout();
    closeUserMenu();
    setMobileMenuOpen(false);
    navigate('/login', { replace: true });
  }, [authStore, closeUserMenu, navigate]);

  useEffect(() => {
    closeUserMenu();
    setMobileMenuOpen(false);
  }, [closeUserMenu, location.pathname]);

  useEffect(() => {
    if (!installCopyNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setInstallCopyNotice('');
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [installCopyNotice]);

  useEffect(() => {
    if (!installHint) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setInstallHint('');
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [installHint]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPromptEvent(promptEvent);
      setInstallHint('');
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setInstallHint('应用已经安装到桌面，可以像原生应用一样直接打开。');
      setIsStandaloneApp(true);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsStandaloneApp(isStandaloneDisplayMode());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const openInstallGuide = useCallback((content: InstallGuideContent) => {
    setInstallGuide(content);
    setInstallCopyNotice('');
    setMobileMenuOpen(false);
  }, []);

  const closeInstallGuide = useCallback(() => {
    setInstallGuide(null);
  }, []);

  const copyInstallLink = useCallback(async () => {
    const url = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      setInstallCopyNotice('当前地址已复制，可以去 Chrome / Edge / Safari 里打开安装。');
    } catch {
      setInstallCopyNotice(`复制失败，请手动复制当前地址：${url}`);
    }
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (isStandaloneApp) {
      setInstallHint('应用已经安装好了。');
      return;
    }

    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallHint('安装请求已提交，系统完成后就能从桌面直接打开。');
      } else {
        setInstallHint('这次先取消了，后面也可以随时再安装。');
      }

      setInstallPromptEvent(null);
      return;
    }

    if (isIosInstallTarget) {
      openInstallGuide({
        title: '请从 Safari 添加到主屏幕',
        description: 'iPhone 或 iPad 上通常不会弹出单独的安装窗口，需要从浏览器菜单手动添加。',
        steps: [
          '在 Safari 里打开当前地址。',
          '点击底部或顶部的“分享”按钮。',
          '选择“添加到主屏幕”，确认后即可像原生应用一样打开。',
        ],
      });
      return;
    }

    if (window.isSecureContext && isInstallPromptSupported()) {
      openInstallGuide({
        title: '当前浏览器没有弹出安装窗口',
        description: '这通常发生在嵌入式浏览器、受限 WebView，或者浏览器暂时没有把当前站点判断为可安装时。',
        steps: [
          '先复制当前地址。',
          '再用系统 Chrome 或 Edge 打开这个地址。',
          '从地址栏右侧或浏览器菜单里选择“安装应用”或“添加到桌面”。',
        ],
      });
      return;
    }

    openInstallGuide({
      title: '当前环境不支持直接安装',
      description: '像内置浏览器这类嵌入式环境，通常不会触发 PWA 的系统安装提示，所以看起来会像“没反应”。',
      steps: [
        '先复制当前地址。',
        '再用系统 Chrome、Edge 或 Safari 打开这个地址。',
        '在浏览器菜单里选择“安装应用”或“添加到主屏幕”。',
      ],
    });
  }, [installPromptEvent, isIosInstallTarget, isStandaloneApp, openInstallGuide]);

  const isNavActive = (path: string) => {
    if (path === '/entry/unified') return location.pathname.startsWith('/entry');
    if (path === '/list/unified') return location.pathname.startsWith('/list');
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const avatarLetter = (authStore.username ?? '?').charAt(0).toUpperCase();
  const roleLabel = authStore.isAdmin ? '管理员' : '普通用户';

  const renderDesktopNav = () => (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {navItems.map((item) => {
        const active = isNavActive(item.path);
        return (
          <Button
            key={item.path}
            component={NavLink}
            to={item.path}
            color="inherit"
            variant={active ? 'contained' : 'text'}
            sx={{
              minHeight: 38,
              px: 1.6,
              color: active ? 'primary.main' : 'text.secondary',
              bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
              '&:hover': {
                bgcolor: active ? alpha(theme.palette.primary.main, 0.16) : alpha(theme.palette.primary.main, 0.06),
              },
            }}
          >
            {item.label}
          </Button>
        );
      })}
    </Stack>
  );

  const renderQuickEntryButton = (mobile = false) => (
    <Button
      component={NavLink}
      to={QUICK_ENTRY_PATH}
      variant="contained"
      color="warning"
      startIcon={<AddRoundedIcon />}
      onClick={() => mobile && setMobileMenuOpen(false)}
      sx={{
        justifyContent: 'flex-start',
        minWidth: mobile ? '100%' : 0,
        px: mobile ? 2 : 1.75,
        py: mobile ? 1.4 : 1,
        borderRadius: mobile ? 3 : 999,
        color: '#7c2d12',
        bgcolor: '#ffedd5',
        boxShadow: '0 10px 24px rgba(249, 115, 22, 0.16)',
        '&:hover': {
          bgcolor: '#fed7aa',
        },
      }}
    >
      <Stack spacing={0.2} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="button" sx={{ color: 'inherit', lineHeight: 1.1 }}>
          快捷录入
        </Typography>
        <Typography variant="caption" sx={{ color: alpha('#7c2d12', 0.78) }}>
          OCR / 手动一体
        </Typography>
      </Stack>
    </Button>
  );

  const renderInstallButton = (mobile = false) => (
    <Button
      variant={mobile ? 'contained' : 'outlined'}
      onClick={handleInstallApp}
      startIcon={<DownloadRoundedIcon />}
      color="primary"
      fullWidth={mobile}
      sx={{
        justifyContent: 'flex-start',
        borderRadius: mobile ? 3 : 999,
        px: mobile ? 2 : 1.5,
        py: mobile ? 1.4 : 1,
        bgcolor: mobile ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.03),
        borderColor: alpha(theme.palette.primary.main, 0.18),
      }}
    >
      <Stack spacing={0.2} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="button" sx={{ lineHeight: 1.1 }}>
          安装应用
        </Typography>
        <Typography variant="caption" color="text.secondary">
          桌面直达 / 离线可开
        </Typography>
      </Stack>
    </Button>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        '--app-navbar-height': '72px',
        [theme.breakpoints.down('sm')]: {
          '--app-navbar-height': '64px',
        },
      }}
    >
      <AppBar
        position="fixed"
        color="transparent"
        sx={{
          bgcolor: alpha('#ffffff', 0.84),
          backdropFilter: 'blur(16px)',
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 } }}>
          <Toolbar
            disableGutters
            sx={{
              minHeight: 'var(--app-navbar-height)',
              gap: 2,
              justifyContent: 'space-between',
            }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Button
                component={NavLink}
                to={homePath}
                color="inherit"
                sx={{
                  minWidth: 0,
                  p: 0.5,
                  pr: 1.25,
                  borderRadius: 999,
                  color: 'text.primary',
                }}
              >
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 2.5,
                      overflow: 'hidden',
                      boxShadow: '0 12px 24px rgba(9, 105, 218, 0.22)',
                    }}
                  >
                    <Box
                      component="img"
                      src="/brand-mark.svg"
                      alt="心魔录"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </Box>
                  <Stack spacing={0} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
                      心魔录
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      交易复盘与画像
                    </Typography>
                  </Stack>
                </Stack>
              </Button>

              {renderDesktopNav()}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {showTradingNavigation && (
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  {renderQuickEntryButton()}
                </Box>
              )}

              {showInstallAction && (
                <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                  {renderInstallButton()}
                </Box>
              )}

              <Button
                color="inherit"
                onClick={(event: ReactMouseEvent<HTMLElement>) => setUserMenuAnchor(event.currentTarget)}
                endIcon={<ArrowDropDownRoundedIcon />}
                sx={{
                  minWidth: 0,
                  borderRadius: 999,
                  border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                  px: { xs: 0.75, sm: 1.1 },
                  py: 0.5,
                  color: 'text.primary',
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Avatar
                    src={authStore.avatarUrl || undefined}
                    alt={`${authStore.username ?? '用户'}头像`}
                    sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}
                  >
                    {avatarLetter}
                  </Avatar>
                  <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, maxWidth: 120 }}>
                      {authStore.username ?? '用户'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {roleLabel}
                    </Typography>
                  </Box>
                  {authStore.isAdmin && (
                    <Chip
                      label="Admin"
                      size="small"
                      color="warning"
                      sx={{ display: { xs: 'none', md: 'inline-flex' }, fontWeight: 700 }}
                    />
                  )}
                </Stack>
              </Button>

              <Tooltip title="菜单">
                <IconButton
                  onClick={() => setMobileMenuOpen(true)}
                  sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                >
                  <MenuRoundedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Menu
        anchorEl={userMenuAnchor}
        open={userMenuOpen}
        onClose={closeUserMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            closeUserMenu();
            navigate('/profile');
          }}
        >
          <PersonRoundedIcon fontSize="small" sx={{ mr: 1.25 }} />
          个人信息
        </MenuItem>
        {authStore.isAdmin && (
          <MenuItem
            onClick={() => {
              closeUserMenu();
              navigate('/admin');
            }}
          >
            <AdminPanelSettingsRoundedIcon fontSize="small" sx={{ mr: 1.25 }} />
            管理员后台
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <LogoutRoundedIcon fontSize="small" sx={{ mr: 1.25 }} />
          退出登录
        </MenuItem>
      </Menu>

      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: 'min(88vw, 340px)',
              p: 1.75,
              borderLeft: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
            },
          },
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              心魔录
            </Typography>
            <Typography variant="body2" color="text.secondary">
              欢迎回来，{authStore.username ?? '用户'} · {roleLabel}
            </Typography>
          </Box>
          <IconButton onClick={() => setMobileMenuOpen(false)}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Stack spacing={1.2}>
          {showTradingNavigation && renderQuickEntryButton(true)}
          {showInstallAction && renderInstallButton(true)}

          <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
            <List disablePadding>
              {navItems.map((item, index) => (
                <Box key={item.path}>
                  {index > 0 && <Divider />}
                  <ListItemButton
                    component={NavLink}
                    to={item.path}
                    selected={isNavActive(item.path)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <ListItemText primary={<Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>} />
                  </ListItemButton>
                </Box>
              ))}
            </List>
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <List disablePadding>
              <ListItemButton
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/profile');
                }}
              >
                <ListItemText primary={<Typography sx={{ fontWeight: 600 }}>个人信息</Typography>} />
              </ListItemButton>
              <Divider />
              <ListItemButton onClick={handleLogout}>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'error.main' }}>退出登录</Typography>}
                />
              </ListItemButton>
            </List>
          </Paper>
        </Stack>
      </Drawer>

      <Snackbar
        open={Boolean(installHint)}
        autoHideDuration={3200}
        onClose={() => setInstallHint('')}
        anchorOrigin={{ vertical: 'top', horizontal: isMobile ? 'center' : 'right' }}
      >
        <Alert
          onClose={() => setInstallHint('')}
          severity="info"
          variant="filled"
          sx={{ alignItems: 'center' }}
        >
          {installHint}
        </Alert>
      </Snackbar>

      <Dialog
        open={Boolean(installGuide)}
        onClose={closeInstallGuide}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pb: 1 }}>
          {installGuide?.title}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            {installGuide?.description}
          </Typography>

          <Box component="ol" sx={{ pl: 2.5, my: 2.25 }}>
            {installGuide?.steps.map((step) => (
              <Typography component="li" key={step} variant="body2" sx={{ mb: 1.1, lineHeight: 1.8 }}>
                {step}
              </Typography>
            ))}
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: 1.6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
            }}
          >
            <Typography variant="caption" color="text.secondary">
              当前地址
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                overflowWrap: 'anywhere',
                color: 'primary.main',
              }}
            >
              {window.location.href}
            </Typography>
          </Paper>

          {installCopyNotice && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {installCopyNotice}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeInstallGuide} color="inherit">
            我知道了
          </Button>
          <Button onClick={copyInstallLink} variant="contained">
            复制当前地址
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        component="main"
        className="layout-content"
        sx={{
          minHeight: '100vh',
          pt: 'calc(var(--app-navbar-height) + 16px)',
          pb: { xs: 3, md: 4 },
        }}
      >
        {children}
      </Box>

      {showFloatingEntry && (
        <Fab
          component={NavLink}
          to={QUICK_ENTRY_PATH}
          color="warning"
          variant="extended"
          aria-label="进入快捷录入页面"
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            position: 'fixed',
            right: 16,
            bottom: 'max(16px, calc(env(safe-area-inset-bottom) + 12px))',
            zIndex: theme.zIndex.appBar - 1,
            color: '#7c2d12',
            bgcolor: '#ffedd5',
            boxShadow: '0 16px 36px rgba(249, 115, 22, 0.24)',
            '&:hover': {
              bgcolor: '#fed7aa',
            },
          }}
        >
          <AddRoundedIcon sx={{ mr: 0.75 }} />
          快捷录入
        </Fab>
      )}
    </Box>
  );
});

export default Layout;
