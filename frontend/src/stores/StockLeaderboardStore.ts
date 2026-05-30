import { makeAutoObservable, runInAction } from 'mobx';
import { statisticsService } from '../services/StatisticsService';
import type { TradeSummaryItem } from '../services/StatisticsService';
import { sortItemsBy } from '../utils/table';

export class StockLeaderboardStore {
  items: TradeSummaryItem[] = [];
  loading = false;
  error: string | null = null;
  loaded = false;

  constructor() {
    makeAutoObservable(this);
  }

  fetch = async (force = false) => {
    if (this.loading || (this.loaded && !force)) {
      return;
    }

    this.loading = true;
    this.error = null;
    try {
      const data = await statisticsService.getSummary({});
      runInAction(() => {
        this.items = data.byStock || [];
        this.loaded = true;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '获取盈亏榜失败';
        this.loading = false;
      });
    }
  };

  get topGainers(): TradeSummaryItem[] {
    return sortItemsBy(
      this.items.filter(item => item.totalCumulativePnL > 0),
      [
        { getValue: item => item.totalCumulativePnL, order: 'desc' },
        { getValue: item => item.stockCode, order: 'asc' },
      ]
    ).slice(0, 20);
  }

  get topLosers(): TradeSummaryItem[] {
    return sortItemsBy(
      this.items.filter(item => item.totalCumulativePnL < 0),
      [
        { getValue: item => item.totalCumulativePnL, order: 'asc' },
        { getValue: item => item.stockCode, order: 'asc' },
      ]
    ).slice(0, 20);
  }

  formatMoney = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  };

  clearError = () => {
    this.error = null;
  };
}

export const stockLeaderboardStore = new StockLeaderboardStore();
