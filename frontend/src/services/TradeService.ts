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
  tradeNote?: string;
  tonghuashunLink?: string;
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
  tradeNote?: string;
  tonghuashunLink?: string;
}

export interface StockTradeApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
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
}

export const tradeService = new TradeService();
