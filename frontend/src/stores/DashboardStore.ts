import { makeAutoObservable, runInAction } from 'mobx';
import { dashboardService } from '../services/DashboardService';
import type { DashboardData } from '../services/DashboardService';

export class DashboardStore {
  data: DashboardData | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  fetchDashboard = async () => {
    this.loading = true;
    this.error = null;

    try {
      const data = await dashboardService.getDashboard();
      runInAction(() => {
        this.data = data;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '获取Dashboard数据失败';
        this.loading = false;
      });
    }
  };

  get todayPnL(): number {
    return this.data?.todayPnL ?? 0;
  }

  get weekPnL(): number {
    return this.data?.weekPnL ?? 0;
  }

  get monthPnL(): number {
    return this.data?.monthPnL ?? 0;
  }

  get cumulativePnL(): number {
    return this.data?.cumulativePnL ?? 0;
  }

  get latestRecordDate(): string | null {
    return this.data?.latestRecordDate ?? null;
  }

  get latestRecordDailyPnL(): number {
    return this.data?.latestRecordDailyPnL ?? 0;
  }

  formatPnL(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '--';
    }

    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${Math.abs(value * 100).toFixed(2)}%`;
  }

  formatRecordDate(value: string | null | undefined): string {
    return value ? value.split('T')[0] : '暂无';
  }

  formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
    const startText = this.formatRecordDate(start);
    const endText = this.formatRecordDate(end);
    return startText === endText ? startText : `${startText} ~ ${endText}`;
  }

  isPnLPositive(value: number): boolean {
    return value >= 0;
  }
}

export const dashboardStore = new DashboardStore();
