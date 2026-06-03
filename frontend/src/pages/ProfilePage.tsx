import { observer } from 'mobx-react-lite';
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../stores/StoreProvider';
import './ProfilePage.css';

const ProfilePage = observer(() => {
  const { authStore } = useStore();

  // 个人信息表单
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // 密码表单
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // 加载个人信息
  useEffect(() => {
    authStore.fetchProfile();
  }, [authStore]);

  // 回填表单
  useEffect(() => {
    if (authStore.profile) {
      setUsername((current) => current || authStore.profile?.username || '');
      setEmail((current) => current || authStore.profile?.email || '');
    }
  }, [authStore.profile]);

  const handleUpdateProfile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    authStore.clearError();

    if (!username.trim() || !email.trim()) {
      return;
    }

    setProfileSubmitting(true);
    try {
      await authStore.updateProfile(username.trim(), email.trim());
      setProfileSuccess('个人信息更新成功');
    } catch {
      // 错误已在 store 中设置
    } finally {
      setProfileSubmitting(false);
    }
  }, [username, email, authStore]);

  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch {
      // 错误已在 store 中设置
    } finally {
      setPasswordSubmitting(false);
    }
  }, [currentPassword, newPassword, confirmPassword, authStore]);

  if (!authStore.profile && !authStore.error) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="profile-spinner" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <header className="profile-header">
        <div>
          <h1 className="profile-title">个人信息</h1>
          <p className="profile-subtitle">查看和修改您的账户信息</p>
        </div>
      </header>

      <main className="profile-main">
        {/* 加载错误 */}
        {authStore.error && !authStore.profile && (
          <div className="profile-banner profile-banner--error">
            加载失败：{authStore.error}
            <button
              className="profile-btn profile-btn--secondary"
              style={{ marginLeft: 12, height: 32, padding: '0 12px', fontSize: '0.75rem' }}
              onClick={() => authStore.fetchProfile()}
              type="button"
            >
              重试
            </button>
          </div>
        )}

        {/* 个人信息卡片 */}
        <div className="profile-card">
          <h2 className="profile-card__title">基本资料</h2>
          {profileSuccess && (
            <div className="profile-banner profile-banner--success">{profileSuccess}</div>
          )}
          {authStore.error && profileSubmitting && (
            <div className="profile-banner profile-banner--error">{authStore.error}</div>
          )}
          <form className="profile-form" onSubmit={handleUpdateProfile}>
            <div className="profile-field">
              <label className="profile-field__label">用户名</label>
              <input
                className="profile-field__input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={50}
              />
            </div>
            <div className="profile-field">
              <label className="profile-field__label">邮箱</label>
              <input
                className="profile-field__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="profile-field">
              <label className="profile-field__label">注册时间</label>
              <input
                className="profile-field__input profile-field__input--readonly"
                type="text"
                value={authStore.profile?.createdAt
                  ? new Date(authStore.profile.createdAt).toLocaleString('zh-CN')
                  : '-'}
                readOnly
              />
            </div>
            <div className="profile-field">
              <label className="profile-field__label">最后登录</label>
              <input
                className="profile-field__input profile-field__input--readonly"
                type="text"
                value={authStore.profile?.lastLoginAt
                  ? new Date(authStore.profile.lastLoginAt).toLocaleString('zh-CN')
                  : '-'}
                readOnly
              />
            </div>
            <div className="profile-actions">
              <button
                className="profile-btn profile-btn--primary"
                type="submit"
                disabled={profileSubmitting}
              >
                {profileSubmitting ? '保存中...' : '保存修改'}
              </button>
            </div>
          </form>
        </div>

        {/* 修改密码卡片 */}
        <div className="profile-card">
          <h2 className="profile-card__title">修改密码</h2>
          {passwordSuccess && (
            <div className="profile-banner profile-banner--success">{passwordSuccess}</div>
          )}
          {authStore.error && passwordSubmitting && (
            <div className="profile-banner profile-banner--error">{authStore.error}</div>
          )}
          <form className="profile-form" onSubmit={handleChangePassword}>
            <div className="profile-field">
              <label className="profile-field__label">当前密码</label>
              <input
                className="profile-field__input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="profile-field">
              <label className="profile-field__label">新密码</label>
              <input
                className="profile-field__input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <span className="profile-field__hint">至少 6 个字符</span>
            </div>
            <div className="profile-field">
              <label className="profile-field__label">确认新密码</label>
              <input
                className="profile-field__input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <span className="profile-field__error">两次密码输入不一致</span>
              )}
            </div>
            <div className="profile-actions">
              <button
                className="profile-btn profile-btn--danger"
                type="submit"
                disabled={
                  passwordSubmitting ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword
                }
              >
                {passwordSubmitting ? '修改中...' : '修改密码'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
});

export default ProfilePage;
