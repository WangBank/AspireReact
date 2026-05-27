const API_BASE = '/api/auth';

export interface CaptchaData {
  captchaId: string;
  captchaImage: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    username: string;
  };
}

export interface CaptchaResponse {
  success: boolean;
  message: string;
  data: CaptchaData;
}

export class AuthService {
  async getCaptcha(): Promise<CaptchaData> {
    const response = await fetch(`${API_BASE}/captcha`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json: CaptchaResponse = await response.json();

    if (!json.success) {
      throw new Error(json.message || '获取验证码失败');
    }

    return json.data;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const json: AuthResponse = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '登录失败');
    }

    return json;
  }

  async register(
    email: string,
    username: string,
    password: string,
    confirmPassword: string,
    captchaId: string,
    captchaCode: string
  ): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, confirmPassword, captchaId, captchaCode }),
    });

    const json: AuthResponse = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '注册失败');
    }

    return json;
  }
}

export const authService = new AuthService();