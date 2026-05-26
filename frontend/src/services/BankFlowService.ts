const API_BASE = '/api/bankflow';

export interface BankFlowRequest {
  date: string; // ISO date string
  flowType: '转入' | '转出';
  amount: number;
  remark?: string;
}

export interface BankFlowResponse {
  id: number;
  date: string;
  flowType: string;
  amount: number;
  remark?: string;
  createdAt: string;
}

export interface BankFlowApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface BankFlowListResponse {
  success: boolean;
  message: string;
  data: BankFlowResponse[];
}

export class BankFlowService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async create(request: BankFlowRequest): Promise<BankFlowApiResponse<BankFlowResponse>> {
    const response = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async getByDateRange(startDate?: string, endDate?: string): Promise<BankFlowListResponse> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const url = `${API_BASE}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { headers: this.getAuthHeaders() });
    return response.json();
  }

  async delete(id: number): Promise<BankFlowApiResponse<null>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }
}

export const bankFlowService = new BankFlowService();
