import { makeAutoObservable, runInAction } from 'mobx';
import { statisticsService } from '../services/StatisticsService';
import type { TradeSummaryResponse, PnLFilter, DateFilterType } from '../services/StatisticsService';
import { clampPage, getTotalPages, nextSortState, paginateItems, sortItemsBy, type SortOrder } from '../utils/table';

export type StatisticsSortField = 'stockCode' | 'stockName' | 'board' | 'totalCumulativePnL';

export class StatisticsStore {
  // 筛选条件
  dateFilterType: DateFilterType = 'month';
  startDate = '';
  endDate = '';
  stockCode = '';
  board = '';
  pnlFilter: PnLFilter = 'all';
  stockSortField: StatisticsSortField = 'totalCumulativePnL';
  stockSortOrder: SortOrder = 'desc';
  stockPage = 1;
  stockPageSize = 30;

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
    this.stockPage = 1;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (type) {
      case 'today':
        this.startDate = this.formatDateInput(today);
        this.endDate = this.formatDateInput(today);
        break;
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // 周日
        this.startDate = this.formatDateInput(weekStart);
        this.endDate = this.formatDateInput(today);
        break;
      }
      case 'month':
        this.startDate = this.formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
        this.endDate = this.formatDateInput(today);
        break;
      case 'year':
        this.startDate = this.formatDateInput(new Date(today.getFullYear(), 0, 1));
        this.endDate = this.formatDateInput(today);
        break;
      case 'all':
        this.startDate = '';
        this.endDate = '';
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
    this.stockPage = 1;
  };

  setStockCode = (code: string) => {
    this.stockCode = code;
  };

  setBoard = (board: string) => {
    this.board = board;
  };

  setPnlFilter = (filter: PnLFilter) => {
    this.pnlFilter = filter;
    this.stockPage = 1;
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
        this.stockPage = clampPage(this.stockPage, this.byStockTotalPages);
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
    const filtered = this.pnlFilter === 'all' ? list : list.filter((item) => {
      const pnl = item.totalCumulativePnL;
      if (this.pnlFilter === 'profit') return pnl >= 0;
      return pnl < 0;
    });

    const accessors: Record<StatisticsSortField, (item: import('../services/StatisticsService').TradeSummaryItem) => string | number> = {
      stockCode: item => item.stockCode,
      stockName: item => item.stockName,
      board: item => item.board,
      totalCumulativePnL: item => item.totalCumulativePnL,
    };

    return sortItemsBy(filtered, [
      { getValue: accessors[this.stockSortField], order: this.stockSortOrder },
      { getValue: item => item.totalCumulativePnL, order: 'desc' },
      { getValue: item => item.stockCode, order: 'asc' },
    ]);
  }

  /** 获取过滤后的按板块汇总列表 */
  get filteredByBoard(): import('../services/StatisticsService').TradeSummaryItem[] {
    if (!this.data) return [];
    const list = this.data.byBoard;
    if (this.pnlFilter === 'all') return list;
    return list.filter((item) => {
      const pnl = item.totalCumulativePnL;
      if (this.pnlFilter === 'profit') return pnl >= 0;
      return pnl < 0;
    });
  }

  /** 格式化金额为带符号的字符串 */
  formatMoney = (val: number): string => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}`;
  };

  formatPercent = (val: number): string => `${(val * 100).toFixed(2)}%`;

  formatDate = (value: string | Date): string => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '--';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  formatDateRange = (start: string | Date, end: string | Date): string => {
    const startText = this.formatDate(start);
    const endText = this.formatDate(end);
    return startText === endText ? startText : `${startText} ~ ${endText}`;
  };

  /** 判断盈亏正负 */
  isPnLPositive = (val: number): boolean => {
    return val >= 0;
  };

  get pagedByStock(): import('../services/StatisticsService').TradeSummaryItem[] {
    return paginateItems(this.filteredByStock, this.stockPage, this.stockPageSize);
  }

  get byStockTotalPages(): number {
    return getTotalPages(this.filteredByStock.length, this.stockPageSize);
  }

  toggleStockSort = (field: StatisticsSortField) => {
    const nextState = nextSortState(this.stockSortField, this.stockSortOrder, field);
    this.stockSortField = nextState.field;
    this.stockSortOrder = nextState.order;
    this.stockPage = 1;
  };

  setStockPage = (page: number) => {
    this.stockPage = clampPage(page, this.byStockTotalPages);
  };

  private formatDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export const statisticsStore = new StatisticsStore();
