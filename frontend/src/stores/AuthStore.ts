import { makeAutoObservable, runInAction } from 'mobx';
import { authService } from '../services/AuthService';
import type { AuthResponse, CaptchaData, UserProfile } from '../services/AuthService';
import { hydrateAuthToken, setAuthToken } from '../utils/authToken';
import {
  readRecentQuickLogins,
  removeRecentQuickLogin,
  type RecentQuickLoginAccount,
  upsertRecentQuickLogin,
} from '../utils/recentQuickLogins';

const USERNAME_KEY = 'auth_username';
const ROLE_KEY = 'auth_role';
const IS_ADMIN_KEY = 'auth_is_admin';
const AVATAR_URL_KEY = 'auth_avatar_url';

const readStoredSessionValue = (key: string): string | null => {
  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) {
      return sessionValue;
    }
  } catch {
    // 忽略会话存储读取失败，继续兼容旧缓存。
  }

  try {
    const legacyLocalValue = localStorage.getItem(key);
    if (!legacyLocalValue) {
      return null;
    }

    sessionStorage.setItem(key, legacyLocalValue);
    localStorage.removeItem(key);
    return legacyLocalValue;
  } catch {
    return null;
  }
};

const persistSessionValue = (key: string, value: string | null) => {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // 忽略会话存储失败，保留内存态即可。
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // 忽略旧缓存清理失败。
  }
};

export class AuthStore {
  token: string | null = null;
  username: string | null = null;
  email: string | null = null;
  role: string | null = null;
  isAdmin = false;
  avatarUrl: string | null = null;
  profile: UserProfile | null = null;
  captcha: CaptchaData | null = null;
  recentQuickLoginAccounts: RecentQuickLoginAccount[] = [];
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    this.token = hydrateAuthToken();
    try {
      this.username = readStoredSessionValue(USERNAME_KEY);
      this.role = readStoredSessionValue(ROLE_KEY);
      this.isAdmin = readStoredSessionValue(IS_ADMIN_KEY) === 'true';
      this.avatarUrl = readStoredSessionValue(AVATAR_URL_KEY);
      this.recentQuickLoginAccounts = readRecentQuickLogins();
    } catch {
      this.username = null;
      this.role = null;
      this.isAdmin = false;
      this.avatarUrl = null;
      this.recentQuickLoginAccounts = [];
    }
  }

  private persistSession() {
    persistSessionValue(USERNAME_KEY, this.username);
    persistSessionValue(ROLE_KEY, this.role);
    persistSessionValue(IS_ADMIN_KEY, String(this.isAdmin));
    persistSessionValue(AVATAR_URL_KEY, this.avatarUrl);
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  fetchCaptcha = async () => {
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

  private rememberRecentQuickLogin(data: AuthResponse['data']) {
    if (!data.quickLogin) {
      return;
    }

    this.recentQuickLoginAccounts = upsertRecentQuickLogin({
      username: data.username,
      role: data.role,
      isAdmin: data.isAdmin,
      avatarUrl: data.avatarUrl,
      quickLogin: data.quickLogin,
    });
  }

  private applyAuthenticatedSession(data: AuthResponse['data']) {
    this.token = data.token;
    this.username = data.username;
    this.role = data.role;
    this.isAdmin = data.isAdmin;
    this.avatarUrl = data.avatarUrl;
    setAuthToken(data.token);
    this.persistSession();
    this.rememberRecentQuickLogin(data);
  }

  login = async (username: string, password: string, captchaId: string, captchaCode: string) => {
    this.loading = true;
    this.error = null;
    try {
      const result = await authService.login(username, password, captchaId, captchaCode);
      runInAction(() => {
        this.applyAuthenticatedSession(result.data);
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '登录失败';
        this.loading = false;
      });
    }
  };

  quickLogin = async (account: RecentQuickLoginAccount) => {
    this.loading = true;
    this.error = null;
    try {
      const result = await authService.quickLogin({
        selector: account.selector,
        validator: account.validator,
      });

      runInAction(() => {
        this.applyAuthenticatedSession(result.data);
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        const status = typeof (err as { status?: number }).status === 'number'
          ? (err as { status: number }).status
          : null;

        if (status === 401) {
          this.recentQuickLoginAccounts = removeRecentQuickLogin(account.username);
        }

        this.error = err instanceof Error ? err.message : '快速登录失败';
        this.loading = false;
      });
      throw err;
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
        this.applyAuthenticatedSession(result.data);
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '注册失败';
        this.loading = false;
      });
    }
  };

  forgetRecentQuickLogin = (username: string) => {
    this.recentQuickLoginAccounts = removeRecentQuickLogin(username);
  };

  fetchProfile = async () => {
    this.error = null;
    try {
      const profile = await authService.getProfile();
      runInAction(() => {
        this.profile = profile;
        this.email = profile.email;
        this.username = profile.username;
        this.role = profile.role;
        this.isAdmin = profile.isAdmin;
        this.avatarUrl = profile.avatarUrl;
      });
      this.persistSession();
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
      this.persistSession();
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

  uploadAvatar = async (file: File) => {
    this.loading = true;
    this.error = null;
    try {
      const profile = await authService.uploadAvatar(file);
      runInAction(() => {
        this.profile = profile;
        this.username = profile.username;
        this.email = profile.email;
        this.role = profile.role;
        this.isAdmin = profile.isAdmin;
        this.avatarUrl = profile.avatarUrl;
        this.loading = false;
      });
      this.persistSession();
      return profile;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '上传头像失败';
        this.loading = false;
      });
      throw err;
    }
  };

  logout = () => {
    this.token = null;
    this.username = null;
    this.email = null;
    this.role = null;
    this.isAdmin = false;
    this.avatarUrl = null;
    this.profile = null;
    this.captcha = null;
    this.error = null;
    setAuthToken(null);
    try {
      sessionStorage.removeItem(USERNAME_KEY);
      sessionStorage.removeItem(ROLE_KEY);
      sessionStorage.removeItem(IS_ADMIN_KEY);
      sessionStorage.removeItem(AVATAR_URL_KEY);
    } catch {
      // 忽略会话存储失败。
    }

    try {
      localStorage.removeItem(USERNAME_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(IS_ADMIN_KEY);
      localStorage.removeItem(AVATAR_URL_KEY);
    } catch {
      // 忽略存储失败。
    }
  };

  clearError = () => {
    this.error = null;
  };
}

export const authStore = new AuthStore();
