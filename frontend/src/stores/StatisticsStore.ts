import { makeAutoObservable, runInAction } from 'mobx';
import { statisticsService } from '../services/StatisticsService';
import type { TradeSummaryResponse, PnLFilter, DateFilterType } from '../services/StatisticsService';

export class StatisticsStore {
  // 筛选条件
  dateFilterType: DateFilterType = 'month';
  startDate = '';
  endDate = '';
  stockCode = '';
  board = '';
  pnlFilter: PnLFilter = 'all';

  // 数据
  data: TradeSummaryResponse | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** 设置日期筛选类型并自动计算日期范围 */
  setDateFilterType = (type: DateFilterType) => {
    this.dateFilterType = type;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (type) {
      case 'today':
        this.startDate = this.formatDate(today);
        this.endDate = this.formatDate(today);
        break;
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // 周日
        this.startDate = this.formatDate(weekStart);
        this.endDate = this.formatDate(today);
        break;
      }
      case 'month':
        this.startDate = this.formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
        this.endDate = this.formatDate(today);
        break;
      case 'custom':
        // 不自动设置，保留用户选择
        break;
    }

    if (type !== 'custom') {
      this.fetch();
    }
  };

  setCustomDateRange = (start: string, end: string) => {
    this.dateFilterType = 'custom';
    this.startDate = start;
    this.endDate = end;
  };

  setStockCode = (code: string) => {
    this.stockCode = code;
  };

  setBoard = (board: string) => {
    this.board = board;
  };

  setPnlFilter = (filter: PnLFilter) => {
    this.pnlFilter = filter;
  };

  /** 获取统计汇总数据 */
  fetch = async () => {
    this.loading = true;
    this.error = null;

    try {
      const data = await statisticsService.getSummary({
        startDate: this.startDate || undefined,
        endDate: this.endDate || undefined,
        stockCode: this.stockCode || undefined,
        board: this.board || undefined,
      });

      runInAction(() => {
        this.data = data;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '获取统计数据失败';
        this.loading = false;
      });
    }
  };

  /** 获取过滤后的按心魔汇总列表 */
  get filteredByStock(): import('../services/StatisticsService').TradeSummaryItem[] {
    if (!this.data) return [];
    const list = this.data.byStock;
    if (this.pnlFilter === 'all') return list;
    return list.filter((item) => {
      const pnl = item.totalPositionPnL;
      if (this.pnlFilter === 'profit') return pnl >= 0;
      return pnl < 0;
    });
  }

  /** 获取过滤后的按板块汇总列表 */
  get filteredByBoard(): import('../services/StatisticsService').TradeSummaryItem[] {
    if (!this.data) return [];
    const list = this.data.byBoard;
    if (this.pnlFilter === 'all') return list;
    return list.filter((item) => {
      const pnl = item.totalPositionPnL;
      if (this.pnlFilter === 'profit') return pnl >= 0;
      return pnl < 0;
    });
  }

  /** 格式化金额为带符号的字符串 */
  formatMoney = (val: number): string => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}`;
  };

  /** 判断盈亏正负 */
  isPnLPositive = (val: number): boolean => {
    return val >= 0;
  };

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export const statisticsStore = new StatisticsStore();
