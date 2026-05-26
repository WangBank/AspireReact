import { makeAutoObservable, runInAction } from 'mobx';
import { bankFlowService } from '../services/BankFlowService';
import type { BankFlowResponse } from '../services/BankFlowService';

export class BankFlowListStore {
  data: BankFlowResponse[] = [];
  loading = false;
  error: string | null = null;
  startDate = '';
  endDate = '';
  page = 1;
  pageSize = 20;

  constructor() {
    makeAutoObservable(this);
  }

  fetch = async () => {
    this.loading = true;
    this.error = null;
    try {
      const res = await bankFlowService.getByDateRange(
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
      const res = await bankFlowService.delete(id);
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

  get pagedData(): BankFlowResponse[] {
    const start = (this.page - 1) * this.pageSize;
    return this.data.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.data.length / this.pageSize));
  }

  setPage = (p: number) => {
    this.page = Math.max(1, Math.min(p, this.totalPages));
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

export const bankFlowListStore = new BankFlowListStore();
