const API_BASE = '/api/stock';

export interface StockSearchResult {
  stockCode: string;
  stockName: string;
  stockAbbr?: string;
  board: string;
}

export interface StockSearchApiResponse {
  success: boolean;
  message: string;
  data: StockSearchResult[];
  total: number;
}

export class StockService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async search(keyword: string): Promise<StockSearchApiResponse> {
    const response = await fetch(
      `${API_BASE}/search?keyword=${encodeURIComponent(keyword)}`,
      { headers: this.getAuthHeaders() }
    );
    return response.json();
  }
}

export const stockService = new StockService();
