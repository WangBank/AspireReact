const API_BASE = '/api/account';

export interface AccountDailyRequest {
  date: string; // ISO date string
  totalAssets: number;
  positionValue: number;
  availableFunds: number;
  dailyPnL: number;
  remark?: string;
}

export interface AccountDailyResponse {
  id: number;
  date: string;
  totalAssets: number;
  positionValue: number;
  availableFunds: number;
  dailyPnL: number;
  remark?: string;
}

export interface AccountApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export class AccountService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async create(request: AccountDailyRequest): Promise<AccountApiResponse<AccountDailyResponse>> {
    const response = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }
}

export const accountService = new AccountService();
