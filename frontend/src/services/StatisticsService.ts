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
  contributionRate: number;
}

export interface TradeBehaviorSummaryItem {
  label: string;
  tradeCount: number;
  winCount: number;
  loseCount: number;
  winRate: number;
  totalPnL: number;
  averagePnL: number;
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
  openDate: string | null;
  holdingDays: number;
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
  recoveryDate: string | null;
  recoveryDays: number | null;
}

export interface AdjustedReturnSummary {
  returnRate: number | null;
  startAssets: number;
  endAssets: number;
  netBankFlow: number;
  weightedCapitalBase: number;
}

export interface DailyPnLHeatmapItem {
  date: string;
  dailyPnL: number;
  totalAssets: number | null;
  netBankFlow: number;
  capitalUtilization: number | null;
}

export interface DayOutcomeSummary {
  profitDays: number;
  lossDays: number;
  flatDays: number;
  profitDayRate: number;
  lossDayRate: number;
  flatDayRate: number;
}

export interface StreakAnalysisSummary {
  maxWinDays: number;
  maxWinStartDate: string | null;
  maxWinEndDate: string | null;
  maxLossDays: number;
  maxLossStartDate: string | null;
  maxLossEndDate: string | null;
}

export interface CycleAnalysisSummary {
  totalCycles: number;
  closedCycles: number;
  openCycles: number;
  closedWinRate: number;
  averageProfitPerCycle: number;
  averageLossPerCycle: number;
  averageHoldingDays: number;
  maxProfitCyclePnL: number;
  maxLossCyclePnL: number;
}

export interface CycleDetailItem {
  stockCode: string;
  stockName: string;
  board: string;
  startDate: string;
  endDate: string | null;
  holdingDays: number;
  totalPnL: number;
  isClosed: boolean;
}

export interface TTradeAnalysisSummary {
  tradeCount: number;
  winCount: number;
  loseCount: number;
  winRate: number;
  totalPnL: number;
  averagePnL: number;
}

export interface TTradeDetailItem {
  tradeDate: string;
  stockCode: string;
  stockName: string;
  board: string;
  buyPrice: number;
  buyQuantity: number;
  sellPrice: number;
  sellQuantity: number;
  positionQuantity: number;
  dailyPnL: number;
  isLiquidated: boolean;
}

export interface CapitalAnalysisSummary {
  latestUtilization: number | null;
  averageUtilization: number | null;
  maxUtilization: number | null;
  dailyVolatility: number | null;
}

export interface PeriodPnLDistributionItem {
  label: string;
  startDate: string;
  endDate: string;
  totalPnL: number;
}

export interface BoardRotationItem {
  board: string;
  totalPnL: number;
  contributionRate: number;
  activeDays: number;
  profitDays: number;
  lossDays: number;
  winDayRate: number;
}

export interface TradeSummaryResponse {
  totalTrades: number;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
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
  bySellReason: TradeBehaviorSummaryItem[];
  byEmotionTag: TradeBehaviorSummaryItem[];
  byTradeTag: TradeBehaviorSummaryItem[];
  dailyWinRates: DailyWinRateItem[];
  bestWinRateDay: DailyWinRateItem | null;
  worstWinRateDay: DailyWinRateItem | null;
  bestProfitInterval: PnLIntervalAnalysisItem | null;
  maxDrawdownInterval: DrawdownAnalysisItem | null;
  adjustedReturn: AdjustedReturnSummary | null;
  dayOutcomes: DayOutcomeSummary | null;
  streakAnalysis: StreakAnalysisSummary | null;
  cycleAnalysis: CycleAnalysisSummary | null;
  cycleDetails: CycleDetailItem[];
  tTradeAnalysis: TTradeAnalysisSummary | null;
  tTradeDetails: TTradeDetailItem[];
  capitalAnalysis: CapitalAnalysisSummary | null;
  dailyPnLHeatmap: DailyPnLHeatmapItem[];
  weeklyPnL: PeriodPnLDistributionItem[];
  monthlyPnL: PeriodPnLDistributionItem[];
  quarterlyPnL: PeriodPnLDistributionItem[];
  boardRotations: BoardRotationItem[];
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
