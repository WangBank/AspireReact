import { makeAutoObservable, runInAction } from 'mobx';
import { authService } from '../services/AuthService';
import type { CaptchaData } from '../services/AuthService';

const TOKEN_KEY = 'jwt_token';
const USERNAME_KEY = 'auth_username';

export class AuthStore {
  token: string | null = null;
  username: string | null = null;
  captcha: CaptchaData | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    this.token = localStorage.getItem(TOKEN_KEY);
    this.username = localStorage.getItem(USERNAME_KEY);
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
      localStorage.setItem(TOKEN_KEY, result.data.token);
      localStorage.setItem(USERNAME_KEY, result.data.username);
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
      localStorage.setItem(TOKEN_KEY, result.data.token);
      localStorage.setItem(USERNAME_KEY, result.data.username);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '注册失败';
        this.loading = false;
      });
    }
  };

  logout = () => {
    this.token = null;
    this.username = null;
    this.captcha = null;
    this.error = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  };

  clearError = () => {
    this.error = null;
  };
}

export const authStore = new AuthStore();