const API_BASE = '/api/stocktrade';

export interface TradeSummaryItem {
  stockCode: string;
  stockName: string;
  board: string;
  tradeCount: number;
  totalPositionPnL: number;
  totalCumulativePnL: number;
  winRate: number;
}

export interface TradeSummaryResponse {
  totalTrades: number;
  totalPnL: number;
  winTrades: number;
  loseTrades: number;
  overallWinRate: number;
  byStock: TradeSummaryItem[];
  byBoard: TradeSummaryItem[];
}

export interface StatisticsApiResponse {
  success: boolean;
  message: string;
  data: TradeSummaryResponse;
}

export type PnLFilter = 'all' | 'profit' | 'loss';
export type DateFilterType = 'today' | 'week' | 'month' | 'custom';

export class StatisticsService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async getSummary(params: {
    startDate?: string;
    endDate?: string;
    stockCode?: string;
    board?: string;
  }): Promise<TradeSummaryResponse> {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.stockCode) searchParams.append('stockCode', params.stockCode);
    if (params.board) searchParams.append('board', params.board);

    const url = `${API_BASE}/summary${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await fetch(url, { headers: this.getAuthHeaders() });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json: StatisticsApiResponse = await response.json();

    if (!json.success) {
      throw new Error(json.message || '获取统计数据失败');
    }

    return json.data;
  }
}

export const statisticsService = new StatisticsService();
