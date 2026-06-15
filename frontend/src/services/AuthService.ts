import { getAuthToken } from '../utils/authToken';

const API_BASE = '/api/auth';

export interface CaptchaData {
  captchaId: string;
  captchaImage: string;
}

export interface QuickLoginTokenPayload {
  selector: string;
  validator: string;
  expiresAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    username: string;
    role: string;
    isAdmin: boolean;
    avatarUrl: string | null;
    quickLogin: QuickLoginTokenPayload | null;
  };
}

export interface CaptchaResponse {
  success: boolean;
  message: string;
  data: CaptchaData;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  isAdmin: boolean;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data: UserProfile;
}

export interface UpdateProfileRequest {
  username: string;
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface QuickLoginRequest {
  selector: string;
  validator: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  data?: {
    username: string;
    email: string;
  };
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

  async login(username: string, password: string, captchaId: string, captchaCode: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, captchaId, captchaCode }),
    });

    const json: AuthResponse = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '登录失败');
    }

    return json;
  }

  async quickLogin(data: QuickLoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/quick-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json: AuthResponse = await response.json();

    if (!response.ok || !json.success) {
      const error = new Error(json.message || '快速登录失败') as Error & { status?: number };
      error.status = response.status;
      throw error;
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

  async getProfile(): Promise<UserProfile> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/profile`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const json: ProfileResponse = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '获取个人信息失败');
    }

    return json.data;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '更新个人信息失败');
    }

    return json;
  }

  async changePassword(data: ChangePasswordRequest): Promise<UpdateProfileResponse> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '修改密码失败');
    }

    return json;
  }

  async uploadAvatar(file: File): Promise<UserProfile> {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_BASE}/profile/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const json: ProfileResponse = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '上传头像失败');
    }

    return json.data;
  }
}

export const authService = new AuthService();
