const API_BASE = '/api/stocktrade';

export interface StockTradeRequest {
  tradeDate: string; // ISO date string
  stockCode: string;
  stockName: string;
  board: string;
  buyPrice: number;
  buyQuantity: number;
  sellPrice: number;
  sellQuantity: number;
  positionPnL: number;
  cumulativePnL: number;
  costPrice: number;
  currentPrice: number;
  tradeNote?: string;
  tonghuashunLink?: string;
}

export interface BatchTradeRequest {
  trades: StockTradeRequest[];
}

export interface BatchTradeResult {
  success: boolean;
  message: string;
  successCount: number;
  failCount: number;
  data?: StockTradeResponse[];
  errors?: string[];
}

export interface StockTradeResponse {
  id: number;
  tradeDate: string;
  stockCode: string;
  stockName: string;
  board: string;
  buyPrice: number;
  buyQuantity: number;
  sellPrice: number;
  sellQuantity: number;
  positionPnL: number;
  cumulativePnL: number;
  costPrice: number;
  currentPrice: number;
  tradeNote?: string;
  tonghuashunLink?: string;
}

export interface StockTradeApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface TradeListResponse {
  success: boolean;
  message: string;
  data: StockTradeResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class TradeService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async create(request: StockTradeRequest): Promise<StockTradeApiResponse<StockTradeResponse>> {
    const response = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async batchCreate(request: BatchTradeRequest): Promise<BatchTradeResult> {
    const response = await fetch(`${API_BASE}/batch`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async query(params: {
    stockCode?: string;
    tradeDate?: string;
    board?: string;
    page?: number;
    pageSize?: number;
  }): Promise<TradeListResponse> {
    const searchParams = new URLSearchParams();
    if (params.stockCode) searchParams.append('stockCode', params.stockCode);
    if (params.tradeDate) searchParams.append('tradeDate', params.tradeDate);
    if (params.board) searchParams.append('board', params.board);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.pageSize) searchParams.append('pageSize', String(params.pageSize));
    const url = `${API_BASE}?${searchParams.toString()}`;
    const response = await fetch(url, { headers: this.getAuthHeaders() });
    return response.json();
  }

  async getById(id: number): Promise<StockTradeApiResponse<StockTradeResponse>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }

  async delete(id: number): Promise<StockTradeApiResponse<null>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }

  async update(id: number, request: StockTradeRequest): Promise<StockTradeApiResponse<StockTradeResponse>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async batchUpdate(trades: { id: number; data: StockTradeRequest }[]): Promise<BatchTradeResult> {
    const response = await fetch(`${API_BASE}/batch`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ trades }),
    });
    return response.json();
  }
}

export const tradeService = new TradeService();
