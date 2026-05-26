import { makeAutoObservable, runInAction } from 'mobx';
import { accountService } from '../services/AccountService';
import type { AccountDailyResponse } from '../services/AccountService';

export type SortField = 'date' | 'totalAssets' | 'dailyPnL';
export type SortOrder = 'asc' | 'desc';

export class AccountListStore {
  data: AccountDailyResponse[] = [];
  loading = false;
  error: string | null = null;
  startDate = '';
  endDate = '';
  sortField: SortField = 'date';
  sortOrder: SortOrder = 'desc';
  page = 1;
  pageSize = 20;

  constructor() {
    makeAutoObservable(this);
  }

  fetch = async () => {
    this.loading = true;
    this.error = null;
    try {
      const res = await accountService.getByDateRange(
        this.startDate || undefined,
        this.endDate || undefined
      );
      runInAction(() => {
        if (res.success) {
          this.data = res.data || [];
        } else {
          this.error = res.message || '查询失败';
          this.data = [];
        }
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
        this.loading = false;
        this.data = [];
      });
    }
  };

  delete = async (id: number): Promise<boolean> => {
    try {
      const res = await accountService.delete(id);
      return runInAction(() => {
        if (res.success) {
          this.data = this.data.filter((d) => d.id !== id);
          return true;
        }
        this.error = res.message || '删除失败';
        return false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '删除失败';
      });
      return false;
    }
  };

  get sortedData(): AccountDailyResponse[] {
    const { sortField, sortOrder } = this;
    return [...this.data].sort((a, b) => {
      let aVal: number | string = a[sortField];
      let bVal: number | string = b[sortField];
      if (sortField === 'date') {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get pagedData(): AccountDailyResponse[] {
    const sorted = this.sortedData;
    const start = (this.page - 1) * this.pageSize;
    return sorted.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.data.length / this.pageSize));
  }

  setPage = (p: number) => {
    this.page = Math.max(1, Math.min(p, this.totalPages));
  };

  toggleSort = (field: SortField) => {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortOrder = 'desc';
    }
    this.page = 1;
  };

  setDateRange = (start: string, end: string) => {
    this.startDate = start;
    this.endDate = end;
    this.page = 1;
  };

  clearError = () => {
    this.error = null;
  };
}

export const accountListStore = new AccountListStore();
