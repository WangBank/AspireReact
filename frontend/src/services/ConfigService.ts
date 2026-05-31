import { getAuthToken } from '../utils/authToken';

const API_BASE = '/api/config';

export interface ConfigResponse {
  tonghuashunLinkPrefix: string;
}

export interface ConfigApiResponse {
  success: boolean;
  message: string;
  data: ConfigResponse;
}

export class ConfigService {
  private getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async get(): Promise<ConfigResponse> {
    const response = await fetch(API_BASE, {
      headers: this.getAuthHeaders(),
    });
    const json: ConfigApiResponse = await response.json();
    if (!json.success) {
      throw new Error(json.message || '获取配置失败');
    }
    return json.data;
  }

  async update(tonghuashunLinkPrefix: string): Promise<ConfigResponse> {
    const response = await fetch(API_BASE, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ tonghuashunLinkPrefix }),
    });
    const json: ConfigApiResponse = await response.json();
    if (!json.success) {
      throw new Error(json.message || '更新配置失败');
    }
    return json.data;
  }
}

export const configService = new ConfigService();
