import { observer } from 'mobx-react-lite';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PageHeader, SectionCard } from '../components/Page';
import { useStore } from '../stores/StoreProvider';
import './ProfilePage.css';

const ProfilePage = observer(() => {
  const { authStore } = useStore();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [avatarSubmitting, setAvatarSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    void authStore.fetchProfile();
  }, [authStore]);

  useEffect(() => {
    if (authStore.profile) {
      setUsername((current) => current || authStore.profile?.username || '');
      setEmail((current) => current || authStore.profile?.email || '');
    }
  }, [authStore.profile]);

  const handleUpdateProfile = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileSuccess(null);
    authStore.clearError();

    if (!username.trim() || !email.trim()) {
      return;
    }

    setProfileSubmitting(true);
    try {
      await authStore.updateProfile(username.trim(), email.trim());
      setProfileSuccess('个人信息更新成功');
    } finally {
      setProfileSubmitting(false);
    }
  }, [authStore, email, username]);

  const handleChangePassword = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordSuccess(null);
    authStore.clearError();

    if (newPassword !== confirmPassword) {
      return;
    }

    setPasswordSubmitting(true);
    try {
      await authStore.changePassword(currentPassword, newPassword);
      setPasswordSuccess('密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setPasswordSubmitting(false);
    }
  }, [authStore, confirmPassword, currentPassword, newPassword]);

  const handleAvatarChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setProfileSuccess(null);
    authStore.clearError();
    setAvatarSubmitting(true);

    try {
      await authStore.uploadAvatar(file);
      setProfileSuccess('头像更新成功');
    } finally {
      setAvatarSubmitting(false);
      event.target.value = '';
    }
  }, [authStore]);

  const avatarLetter = (authStore.username ?? authStore.profile?.username ?? '?').charAt(0).toUpperCase();
  const profileRoleLabel = authStore.isAdmin ? '管理员' : (authStore.role || '普通用户');
  const latestLoginText = authStore.profile?.lastLoginAt
    ? new Date(authStore.profile.lastLoginAt).toLocaleString('zh-CN')
    : '未记录';
  const createdAtText = authStore.profile?.createdAt
    ? new Date(authStore.profile.createdAt).toLocaleString('zh-CN')
    : '-';
  const roleText = authStore.isAdmin ? 'Admin / 管理员' : (authStore.role || 'User / 普通用户');
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  if (!authStore.profile && !authStore.error) {
    return (
      <div className="profile-container">
        <Stack
          className="profile-loading"
          spacing={1.5}
          sx={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <CircularProgress size={30} />
          <Typography variant="body2" color="text.secondary">
            加载中...
          </Typography>
        </Stack>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <PageHeader
        title="个人信息"
        subtitle="查看账户资料、头像和安全设置。"
        stats={[
          { label: '账户角色', value: profileRoleLabel },
          { label: '最近登录', value: latestLoginText },
        ]}
      />

      <main className="profile-main">
        {authStore.error && !authStore.profile && (
          <Alert
            severity="error"
            action={(
              <Button color="inherit" size="small" onClick={() => void authStore.fetchProfile()}>
                重试
              </Button>
            )}
          >
            加载失败：{authStore.error}
          </Alert>
        )}

        <SectionCard
          title="基本资料"
          description="维护头像、用户名和邮箱。头像上传后会在消息和后台页同步展示。"
        >
          <Stack component="form" spacing={2} onSubmit={handleUpdateProfile}>
            {profileSuccess ? <Alert severity="success">{profileSuccess}</Alert> : null}
            {authStore.error && profileSubmitting ? <Alert severity="error">{authStore.error}</Alert> : null}

            <Box
              sx={(theme) => ({
                p: { xs: 2, md: 2.25 },
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
                backgroundColor: alpha(theme.palette.background.default, 0.7),
              })}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}>
                <Avatar
                  src={authStore.avatarUrl ?? undefined}
                  alt={`${authStore.username ?? '用户'}头像`}
                  sx={(theme) => ({
                    width: 84,
                    height: 84,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                    fontSize: 32,
                    fontWeight: 800,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  })}
                >
                  {avatarLetter}
                </Avatar>

                <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      头像
                    </Typography>
                    <Chip
                      label={profileRoleLabel}
                      color={authStore.isAdmin ? 'warning' : 'default'}
                      variant={authStore.isAdmin ? 'filled' : 'outlined'}
                      size="small"
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    支持 PNG、JPG、JPEG、WebP，建议上传清晰的方形图片。
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    <Button
                      variant="outlined"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarSubmitting}
                    >
                      {avatarSubmitting ? '上传中...' : '更换头像'}
                    </Button>
                  </Stack>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                </Stack>
              </Stack>
            </Box>

            <TextField
              label="用户名"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              slotProps={{ htmlInput: { minLength: 3, maxLength: 50 } }}
              helperText="至少 3 个字符"
              fullWidth
            />
            <TextField
              label="邮箱"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="账户角色"
              value={roleText}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="注册时间"
              value={createdAtText}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="最后登录"
              value={latestLoginText}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" disabled={profileSubmitting}>
                {profileSubmitting ? '保存中...' : '保存修改'}
              </Button>
            </Stack>
          </Stack>
        </SectionCard>

        <SectionCard
          title="修改密码"
          description="修改当前账号密码。密码至少 6 个字符。"
        >
          <Stack component="form" spacing={2} onSubmit={handleChangePassword}>
            {passwordSuccess ? <Alert severity="success">{passwordSuccess}</Alert> : null}
            {authStore.error && passwordSubmitting ? <Alert severity="error">{authStore.error}</Alert> : null}

            <TextField
              label="当前密码"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="新密码"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              slotProps={{ htmlInput: { minLength: 6 } }}
              helperText="至少 6 个字符"
              fullWidth
            />
            <TextField
              label="确认新密码"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              error={passwordMismatch}
              helperText={passwordMismatch ? '两次密码输入不一致' : '再次确认本次修改密码'}
              fullWidth
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                color="error"
                disabled={
                  passwordSubmitting
                  || !currentPassword
                  || !newPassword
                  || !confirmPassword
                  || passwordMismatch
                }
              >
                {passwordSubmitting ? '修改中...' : '修改密码'}
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      </main>
    </div>
  );
});

export default ProfilePage;
