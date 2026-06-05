import { getAuthToken } from '../utils/authToken';

const API_BASE = '/api/reflection';

export interface ReflectionContent {
  content: string;
  updatedAt: string | null;
  updatedByUsername: string | null;
}

interface ReflectionApiResponse {
  success: boolean;
  message: string;
  data?: ReflectionContent;
}

export class ReflectionService {
  private getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getContent(): Promise<ReflectionContent> {
    const response = await fetch(API_BASE, {
      headers: this.getAuthHeaders(),
    });
    const json: ReflectionApiResponse = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '加载吾日三省吾身内容失败');
    }

    return json.data;
  }
}

export const reflectionService = new ReflectionService();
