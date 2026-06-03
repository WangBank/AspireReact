import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { useStore } from '../stores/StoreProvider';
import './LoginPage.css';

const LoginPage = observer(() => {
  const { authStore } = useStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    authStore.fetchCaptcha();
    return () => {
      authStore.clearError();
    };
  }, [authStore]);

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
    if (!captchaCode.trim()) {
      newErrors.captcha = '请输入验证码';
    } else if (captchaCode.length !== 4 || !/^\d{4}$/.test(captchaCode)) {
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
        captchaCode
      );
    } else {
      await authStore.login(username.trim(), password);
    }
  };

  const handleRefreshCaptcha = () => {
    setCaptchaCode('');
    authStore.fetchCaptcha();
  };

  const captchaSvg = authStore.captcha
    ? `data:image/svg+xml;base64,${authStore.captcha.captchaImage}`
    : null;

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">心魔录</h1>
        <p className="login-subtitle">{isRegister ? '创建新账户' : '请登录您的账户'}</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {authStore.error && (
            <div className="login-error-banner" role="alert">
              {authStore.error}
            </div>
          )}

          {isRegister && (
            <div className="form-group">
              <label htmlFor="email" className="form-label">邮箱</label>
              <input
                id="email"
                type="email"
                className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: '' })); }}
                autoComplete="email"
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username" className="form-label">用户名</label>
            <input
              id="username"
              type="text"
              className={`form-input ${errors.username ? 'form-input-error' : ''}`}
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErrors((prev) => ({ ...prev, username: '' })); }}
              autoComplete="username"
              autoFocus
            />
            {errors.username && <span className="form-error">{errors.username}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">密码</label>
            <input
              id="password"
              type="password"
              className={`form-input ${errors.password ? 'form-input-error' : ''}`}
              placeholder="请输入密码"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '' })); }}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">确认密码</label>
              <input
                id="confirmPassword"
                type="password"
                className={`form-input ${errors.confirmPassword ? 'form-input-error' : ''}`}
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((prev) => ({ ...prev, confirmPassword: '' })); }}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="captcha" className="form-label">验证码</label>
            <div className="captcha-row">
              <input
                id="captcha"
                type="text"
                className={`form-input captcha-input ${errors.captcha ? 'form-input-error' : ''}`}
                placeholder="4位数字"
                value={captchaCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCaptchaCode(val);
                  setErrors((prev) => ({ ...prev, captcha: '' }));
                }}
                maxLength={4}
                autoComplete="off"
              />
              {captchaSvg ? (
                <button
                  type="button"
                  className="captcha-img-btn"
                  onClick={handleRefreshCaptcha}
                  title="点击刷新验证码"
                >
                  <img
                    src={captchaSvg}
                    alt="验证码"
                    className="captcha-img"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  className="captcha-refresh-btn"
                  onClick={handleRefreshCaptcha}
                >
                  获取验证码
                </button>
              )}
            </div>
            {errors.captcha && <span className="form-error">{errors.captcha}</span>}
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={authStore.loading}
          >
            {authStore.loading
              ? (isRegister ? '注册中...' : '登录中...')
              : (isRegister ? '注 册' : '登 录')}
          </button>

          <div className="mode-toggle">
            <button type="button" className="toggle-link" onClick={toggleMode}>
              {isRegister ? '已有账户？去登录' : '没有账户？去注册'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default LoginPage;
