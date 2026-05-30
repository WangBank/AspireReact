import { makeAutoObservable, runInAction } from 'mobx';
import { bankFlowService } from '../services/BankFlowService';
import type { BankFlowResponse } from '../services/BankFlowService';
import { clampPage, getTotalPages, nextSortState, paginateItems, sortItemsBy, type SortOrder } from '../utils/table';

export type BankFlowSortField = 'date' | 'flowType' | 'amount' | 'remark';

export class BankFlowListStore {
  data: BankFlowResponse[] = [];
  loading = false;
  error: string | null = null;
  startDate = '';
  endDate = '';
  sortField: BankFlowSortField = 'date';
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
      const res = await bankFlowService.getByDateRange(
        this.startDate || undefined,
        this.endDate || undefined
      );
      runInAction(() => {
        if (res.success) {
          this.data = res.data || [];
          this.page = clampPage(this.page, this.totalPages);
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

  get sortedData(): BankFlowResponse[] {
    const accessors: Record<BankFlowSortField, (item: BankFlowResponse) => string | number | Date | null | undefined> = {
      date: item => new Date(item.date),
      flowType: item => item.flowType,
      amount: item => item.amount,
      remark: item => item.remark,
    };

    return sortItemsBy(this.data, [
      { getValue: accessors[this.sortField], order: this.sortOrder },
      { getValue: item => new Date(item.date), order: 'desc' },
      { getValue: item => item.id, order: 'desc' },
    ]);
  }

  get pagedData(): BankFlowResponse[] {
    return paginateItems(this.sortedData, this.page, this.pageSize);
  }

  get totalPages(): number {
    return getTotalPages(this.data.length, this.pageSize);
  }

  setPage = (p: number) => {
    this.page = clampPage(p, this.totalPages);
  };

  toggleSort = (field: BankFlowSortField) => {
    const nextState = nextSortState(this.sortField, this.sortOrder, field);
    this.sortField = nextState.field;
    this.sortOrder = nextState.order;
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

export const bankFlowListStore = new BankFlowListStore();
