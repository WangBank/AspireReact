import { makeAutoObservable, runInAction } from 'mobx';
import { authService } from '../services/AuthService';
import type { CaptchaData, UserProfile } from '../services/AuthService';
import { hydrateAuthToken, setAuthToken } from '../utils/authToken';

const USERNAME_KEY = 'auth_username';

export class AuthStore {
  token: string | null = null;
  username: string | null = null;
  email: string | null = null;
  profile: UserProfile | null = null;
  captcha: CaptchaData | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    this.token = hydrateAuthToken();
    try {
      this.username = localStorage.getItem(USERNAME_KEY);
    } catch {
      this.username = null;
    }
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  fetchCaptcha = async () => {
    this.error = null;
    try {
      const data = await authService.getCaptcha();
      runInAction(() => {
        this.captcha = data;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '获取验证码失败';
      });
    }
  };

  login = async (username: string, password: string) => {
    this.loading = true;
    this.error = null;
    try {
      const result = await authService.login(username, password);
      runInAction(() => {
        this.token = result.data.token;
        this.username = result.data.username;
        this.loading = false;
      });
      setAuthToken(result.data.token);
      try {
        localStorage.setItem(USERNAME_KEY, result.data.username);
      } catch {
        // 忽略存储失败，当前会话仍然保留内存态用户名。
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '登录失败';
        this.loading = false;
      });
    }
  };

  register = async (
    email: string,
    username: string,
    password: string,
    confirmPassword: string,
    captchaId: string,
    captchaCode: string
  ) => {
    this.loading = true;
    this.error = null;
    try {
      const result = await authService.register(
        email,
        username,
        password,
        confirmPassword,
        captchaId,
        captchaCode
      );
      runInAction(() => {
        this.token = result.data.token;
        this.username = result.data.username;
        this.loading = false;
      });
      setAuthToken(result.data.token);
      try {
        localStorage.setItem(USERNAME_KEY, result.data.username);
      } catch {
        // 忽略存储失败，当前会话仍然保留内存态用户名。
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '注册失败';
        this.loading = false;
      });
    }
  };

  fetchProfile = async () => {
    this.error = null;
    try {
      const profile = await authService.getProfile();
      runInAction(() => {
        this.profile = profile;
        this.email = profile.email;
        this.username = profile.username;
      });
      try {
        localStorage.setItem(USERNAME_KEY, profile.username);
      } catch {
        // 忽略存储失败，当前会话仍然保留内存态用户名。
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '获取个人信息失败';
      });
    }
  };

  updateProfile = async (username: string, email: string) => {
    this.loading = true;
    this.error = null;
    try {
      const result = await authService.updateProfile({ username, email });
      runInAction(() => {
        if (result.data) {
          this.username = result.data.username;
          this.email = result.data.email;
          if (this.profile) {
            this.profile.username = result.data.username;
            this.profile.email = result.data.email;
          }
        }
        this.loading = false;
      });
      if (result.data) {
        try {
          localStorage.setItem(USERNAME_KEY, result.data.username);
        } catch {
          // 忽略存储失败，当前会话仍然保留内存态用户名。
        }
      }
      return result;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '更新个人信息失败';
        this.loading = false;
      });
      throw err;
    }
  };

  changePassword = async (currentPassword: string, newPassword: string) => {
    this.loading = true;
    this.error = null;
    try {
      const result = await authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword: newPassword,
      });
      runInAction(() => {
        this.loading = false;
      });
      return result;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '修改密码失败';
        this.loading = false;
      });
      throw err;
    }
  };

  logout = () => {
    this.token = null;
    this.username = null;
    this.email = null;
    this.profile = null;
    this.captcha = null;
    this.error = null;
    setAuthToken(null);
    try {
      localStorage.removeItem(USERNAME_KEY);
    } catch {
      // 忽略存储失败。
    }
  };

  clearError = () => {
    this.error = null;
  };
}

export const authStore = new AuthStore();
