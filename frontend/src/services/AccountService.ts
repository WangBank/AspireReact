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

export interface AccountListResponse {
  success: boolean;
  message: string;
  data: AccountDailyResponse[];
  total: number;
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

  async getByDateRange(startDate?: string, endDate?: string): Promise<AccountListResponse> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const url = `${API_BASE}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { headers: this.getAuthHeaders() });
    return response.json();
  }

  async getById(id: number): Promise<AccountApiResponse<AccountDailyResponse>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }

  async update(id: number, request: AccountDailyRequest): Promise<AccountApiResponse<AccountDailyResponse>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async delete(id: number): Promise<AccountApiResponse<null>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }
}

export const accountService = new AccountService();
