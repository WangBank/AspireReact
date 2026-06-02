import { getAuthToken } from '../utils/authToken';
import type { DailyPnLHeatmapItem } from './StatisticsService';

const API_BASE = '/api/dashboard';

export interface AccountDailyResponse {
  id: number;
  date: string;
  totalAssets: number;
  positionValue: number;
  availableFunds: number;
  dailyPnL: number;
  remark: string | null;
}

export interface BankFlowResponse {
  id: number;
  date: string;
  flowType: string;
  amount: number;
  remark: string | null;
  createdAt: string;
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
  positionQuantity: number;
  dailyPnL: number;
  isLiquidated: boolean;
  tradeNote: string | null;
  tonghuashunLink: string | null;
}

export interface DashboardData {
  todayPnL: number;
  weekPnL: number;
  monthPnL: number;
  cumulativePnL: number;
  latestRecordDate: string | null;
  latestRecordDailyPnL: number;
  latestAccount: AccountDailyResponse | null;
  recentBankFlows: BankFlowResponse[];
  recentTrades: StockTradeResponse[];
  dailyPnLHeatmap: DailyPnLHeatmapItem[];
  periodSummaries: DashboardPeriodSummary[];
}

export interface DashboardBenchmarkSummary {
  key: string;
  name: string;
  returnRate: number | null;
}

export interface DashboardPeriodSummary {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  pnl: number;
  returnRate: number | null;
  benchmarks: DashboardBenchmarkSummary[];
}

export interface DashboardResponse {
  success: boolean;
  message: string;
  data: DashboardData;
}

export class DashboardService {
  async getDashboard(): Promise<DashboardData> {
    const token = getAuthToken();

    const response = await fetch(API_BASE, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json: DashboardResponse = await response.json();

    if (!json.success) {
      throw new Error(json.message || '获取首页概览失败');
    }

    return {
      ...json.data,
      dailyPnLHeatmap: json.data.dailyPnLHeatmap ?? [],
      periodSummaries: (json.data.periodSummaries ?? []).map((item: DashboardPeriodSummary & { pnL?: number }) => ({
        ...item,
        pnl: item.pnl ?? item.pnL ?? 0,
        benchmarks: item.benchmarks ?? [],
      })),
    };
  }
}

export const dashboardService = new DashboardService();
