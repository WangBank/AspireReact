import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { useStore } from '../stores/StoreProvider';
import './LoginPage.css';

const LoginPage = observer(() => {
  const { authStore } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    authStore.fetchCaptcha();
    return () => {
      authStore.clearError();
    };
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) {
      newErrors.username = '请输入用户名';
    }
    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }
    if (!captchaCode.trim()) {
      newErrors.captcha = '请输入验证码';
    } else if (captchaCode.length !== 4 || !/^\d{4}$/.test(captchaCode)) {
      newErrors.captcha = '验证码为4位数字';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await authStore.login(username.trim(), password);
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
        <h1 className="login-title">股票交易记录管理系统</h1>
        <p className="login-subtitle">请登录您的账户</p>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          {authStore.error && (
            <div className="login-error-banner" role="alert">
              {authStore.error}
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
              autoComplete="current-password"
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

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
            {authStore.loading ? '登录中...' : '登 录'}
          </button>
        </form>
      </div>
    </div>
  );
});

export default LoginPage;