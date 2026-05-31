import { getAuthToken } from '../utils/authToken';

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

export interface PositionSummaryItem {
  stockCode: string;
  stockName: string;
  board: string;
  positionQuantity: number;
  costPrice: number;
  currentPrice: number;
  positionPnL: number;
  dailyPnL: number;
  lastUpdateDate: string;
}

export interface DailyWinRateItem {
  date: string;
  winCount: number;
  loseCount: number;
  winRate: number;
  totalPnL: number;
}

export interface PnLIntervalAnalysisItem {
  startDate: string;
  endDate: string;
  tradingDays: number;
  totalPnL: number;
}

export interface DrawdownAnalysisItem {
  peakDate: string;
  troughDate: string;
  peakValue: number;
  troughValue: number;
  drawdownAmount: number;
  drawdownRate: number;
}

export interface TradeSummaryResponse {
  totalTrades: number;
  totalPnL: number;
  netBankFlow: number;
  totalBankInflow: number;
  totalBankOutflow: number;
  currentTotalAmount: number;
  winTrades: number;
  loseTrades: number;
  overallWinRate: number;
  byStock: TradeSummaryItem[];
  byBoard: TradeSummaryItem[];
  positionCount: number;
  totalPositionValue: number;
  totalPositionPnL: number;
  totalDailyPnL: number;
  positions: PositionSummaryItem[];
  dailyWinRates: DailyWinRateItem[];
  bestWinRateDay: DailyWinRateItem | null;
  worstWinRateDay: DailyWinRateItem | null;
  bestProfitInterval: PnLIntervalAnalysisItem | null;
  maxDrawdownInterval: DrawdownAnalysisItem | null;
}

export interface StatisticsApiResponse {
  success: boolean;
  message: string;
  data: TradeSummaryResponse;
}

export type PnLFilter = 'all' | 'profit' | 'loss';
export type DateFilterType = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export class StatisticsService {
  private getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
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
