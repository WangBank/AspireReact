import { makeAutoObservable, runInAction } from 'mobx';
import { tradeService } from '../services/TradeService';
import type { StockTradeResponse, TradeListResponse } from '../services/TradeService';

export type TradeSortField = 'tradeDate' | 'stockCode' | 'buyPrice' | 'sellPrice' | 'positionPnL';
export type TradeSortOrder = 'asc' | 'desc';

export class TradeListStore {
  data: StockTradeResponse[] = [];
  loading = false;
  error: string | null = null;
  keyword = '';
  tradeDate = '';
  board = '';
  sortField: TradeSortField = 'tradeDate';
  sortOrder: TradeSortOrder = 'desc';
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  constructor() {
    makeAutoObservable(this);
  }

  fetch = async () => {
    this.loading = true;
    this.error = null;
    try {
      const res: TradeListResponse = await tradeService.query({
        stockCode: this.keyword || undefined,
        tradeDate: this.tradeDate || undefined,
        board: this.board || undefined,
        page: this.page,
        pageSize: this.pageSize,
      });
      runInAction(() => {
        if (res.success) {
          this.data = res.data || [];
          this.total = res.total || 0;
          this.totalPages = res.totalPages || 1;
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
      const res = await tradeService.delete(id);
      return runInAction(() => {
        if (res.success) {
          this.data = this.data.filter((d) => d.id !== id);
          this.total = Math.max(0, this.total - 1);
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

  get sortedData(): StockTradeResponse[] {
    const { sortField, sortOrder } = this;
    return [...this.data].sort((a, b) => {
      let aVal: number | string = a[sortField];
      let bVal: number | string = b[sortField];
      if (sortField === 'tradeDate') {
        aVal = new Date(a.tradeDate).getTime();
        bVal = new Date(b.tradeDate).getTime();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get displayedData(): StockTradeResponse[] {
    return this.sortedData;
  }

  toggleSort = (field: TradeSortField) => {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortOrder = 'desc';
    }
    this.page = 1;
  };

  setFilters = (filters: { keyword?: string; tradeDate?: string; board?: string }) => {
    if (filters.keyword !== undefined) this.keyword = filters.keyword;
    if (filters.tradeDate !== undefined) this.tradeDate = filters.tradeDate;
    if (filters.board !== undefined) this.board = filters.board;
    this.page = 1;
  };

  setPage = (p: number) => {
    this.page = Math.max(1, Math.min(p, this.totalPages));
  };

  clearError = () => {
    this.error = null;
  };
}

export const tradeListStore = new TradeListStore();
