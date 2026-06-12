import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { useStore } from '../stores/StoreProvider';
import type { RecentQuickLoginAccount } from '../utils/recentQuickLogins';

const formatRecentLoginTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '刚刚';
  }

  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const LoginPage = observer(() => {
  const { authStore } = useStore();
  const theme = useTheme();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => authStore.clearError();
  }, [authStore]);

  useEffect(() => {
    if (isRegister) {
      void authStore.fetchCaptcha();
    }
  }, [authStore, isRegister]);

  const toggleMode = () => {
    setIsRegister((prev) => !prev);
    setErrors({});
    authStore.clearError();
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setCaptchaCode('');
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (username.trim().length < 3) {
      newErrors.username = '用户名至少3个字符';
    }
    if (isRegister && !email.trim()) {
      newErrors.email = '请输入邮箱';
    } else if (isRegister && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '邮箱格式不正确';
    }
    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }
    if (isRegister && !confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (isRegister && password !== confirmPassword) {
      newErrors.confirmPassword = '两次密码输入不一致';
    }
    if (isRegister && !captchaCode.trim()) {
      newErrors.captcha = '请输入验证码';
    } else if (isRegister && (captchaCode.length !== 4 || !/^\d{4}$/.test(captchaCode))) {
      newErrors.captcha = '验证码为4位数字';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isRegister) {
      await authStore.register(
        email.trim(),
        username.trim(),
        password,
        confirmPassword,
        authStore.captcha?.captchaId ?? '',
        captchaCode,
      );
    } else {
      await authStore.login(username.trim(), password);
    }
  };

  const handleRefreshCaptcha = () => {
    setCaptchaCode('');
    authStore.fetchCaptcha();
  };

  const handleQuickLogin = async (account: RecentQuickLoginAccount) => {
    try {
      await authStore.quickLogin(account);
    } catch {
      // 错误信息已写入 store，这里不重复处理。
    }
  };

  const captchaSvg = authStore.captcha
    ? `data:image/svg+xml;base64,${authStore.captcha.captchaImage}`
    : null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 4, md: 6 },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            overflow: 'hidden',
            borderRadius: { xs: 4, md: 5 },
          }}
        >
          <Box
            sx={{
              px: { xs: 2.5, sm: 4 },
              pt: { xs: 2.75, sm: 3.5 },
              pb: 2.5,
              background: [
                `radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.14)}, transparent 26%)`,
                `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.16)}, transparent 28%)`,
                'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.98) 100%)',
              ].join(','),
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 3,
                  overflow: 'hidden',
                  boxShadow: '0 12px 24px rgba(9, 105, 218, 0.16)',
                }}
              >
                <Box
                  component="img"
                  src="/brand-mark.svg"
                  alt="心魔录"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  心魔录
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isRegister ? '创建新账户，开始统一记录交易复盘。' : '登录后继续录入、统计和复盘。'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              px: { xs: 2.5, sm: 4 },
              py: { xs: 2.5, sm: 3.25 },
            }}
          >
            <Stack spacing={2}>
              {authStore.error && (
                <Alert severity="error" variant="filled">
                  {authStore.error}
                </Alert>
              )}

              {!isRegister && authStore.recentQuickLoginAccounts.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.primary.main, 0.035),
                    borderColor: alpha(theme.palette.primary.main, 0.16),
                  }}
                >
                  <Stack spacing={1.25}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        最近成功登录
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        仅保存在当前浏览器，点击账户可直接登录，无需再次输入验证码。
                      </Typography>
                    </Box>

                    {authStore.recentQuickLoginAccounts.map((account, index) => (
                      <Box key={account.username}>
                        {index > 0 && <Divider sx={{ mb: 1.25 }} />}
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1.25}
                          sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
                        >
                          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                            <Avatar src={account.avatarUrl ?? undefined} alt={account.username}>
                              {account.username.slice(0, 1).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                  {account.username}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={account.isAdmin ? '管理员' : account.role || '普通用户'}
                                  color={account.isAdmin ? 'warning' : 'default'}
                                  variant={account.isAdmin ? 'filled' : 'outlined'}
                                />
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                最近登录 {formatRecentLoginTime(account.lastUsedAt)}
                              </Typography>
                            </Box>
                          </Stack>

                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                            <Button
                              type="button"
                              variant="contained"
                              onClick={() => void handleQuickLogin(account)}
                              disabled={authStore.loading}
                            >
                              点击登录
                            </Button>
                            <IconButton
                              aria-label={`移除 ${account.username}`}
                              onClick={() => authStore.forgetRecentQuickLogin(account.username)}
                              disabled={authStore.loading}
                            >
                              <CloseRoundedIcon />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}

              {isRegister && (
                <TextField
                  label="邮箱"
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  autoComplete="email"
                  error={Boolean(errors.email)}
                  helperText={errors.email || '用于找回密码和接收通知'}
                  fullWidth
                />
              )}

              <TextField
                label="用户名"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrors((prev) => ({ ...prev, username: '' }));
                }}
                autoComplete="username"
                autoFocus
                error={Boolean(errors.username)}
                helperText={errors.username || '至少 3 个字符'}
                fullWidth
              />

              <TextField
                label="密码"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: '' }));
                }}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                error={Boolean(errors.password)}
                helperText={errors.password || '至少 6 个字符'}
                fullWidth
              />

              {isRegister && (
                <TextField
                  label="确认密码"
                  type="password"
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  autoComplete="new-password"
                  error={Boolean(errors.confirmPassword)}
                  helperText={errors.confirmPassword || '再次确认本次注册密码'}
                  fullWidth
                />
              )}

              {isRegister && (
                <TextField
                  label="验证码"
                  placeholder="请输入 4 位数字"
                  value={captchaCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCaptchaCode(val);
                    setErrors((prev) => ({ ...prev, captcha: '' }));
                  }}
                  slotProps={{
                    htmlInput: { maxLength: 4, inputMode: 'numeric' },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end" sx={{ ml: 1 }}>
                          {captchaSvg ? (
                            <Button
                              type="button"
                              onClick={handleRefreshCaptcha}
                              sx={{
                                minWidth: 128,
                                height: 48,
                                p: 0,
                                overflow: 'hidden',
                                borderRadius: 2,
                                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                              }}
                            >
                              <Box
                                component="img"
                                src={captchaSvg}
                                alt="验证码"
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                            </Button>
                          ) : (
                            <IconButton onClick={handleRefreshCaptcha} color="primary">
                              <RefreshRoundedIcon />
                            </IconButton>
                          )}
                        </InputAdornment>
                      ),
                    },
                  }}
                  autoComplete="off"
                  error={Boolean(errors.captcha)}
                  helperText={errors.captcha || '点击右侧验证码可以刷新'}
                  fullWidth
                />
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={authStore.loading}
                sx={{ mt: 0.5, minHeight: 48 }}
              >
                {authStore.loading
                  ? (isRegister ? '注册中...' : '登录中...')
                  : (isRegister ? '注册账号' : '登录系统')}
              </Button>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                  pt: 0.5,
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {isRegister ? '已经有账户了？' : '还没有账户？'}
                </Typography>
                <Button variant="text" onClick={toggleMode} sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
                  {isRegister ? '返回登录' : '立即注册'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
});

export default LoginPage;
