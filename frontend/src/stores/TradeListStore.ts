import { makeAutoObservable, runInAction } from 'mobx';
import { tradeService } from '../services/TradeService';
import type { StockTradeResponse } from '../services/TradeService';
import { clampPage, getTotalPages, nextSortState, paginateItems, sortItemsBy, type SortOrder } from '../utils/table';

export type TradeSortField =
  | 'tradeDate'
  | 'stockCode'
  | 'stockName'
  | 'board'
  | 'status'
  | 'buyPrice'
  | 'buyQuantity'
  | 'sellPrice'
  | 'sellQuantity'
  | 'positionPnL'
  | 'cumulativePnL'
  | 'tradeNote';

export class TradeListStore {
  data: StockTradeResponse[] = [];
  loading = false;
  error: string | null = null;
  keyword = '';
  tradeDate = '';
  board = '';
  sortField: TradeSortField = 'tradeDate';
  sortOrder: SortOrder = 'desc';
  page = 1;
  pageSize = 20;
  total = 0;

  constructor() {
    makeAutoObservable(this);
  }

  fetch = async () => {
    this.loading = true;
    this.error = null;
    try {
      const res = await tradeService.query({
        stockCode: this.keyword || undefined,
        tradeDate: this.tradeDate || undefined,
        board: this.board || undefined,
        page: 1,
        pageSize: 5000,
      });
      runInAction(() => {
        if (res.success) {
          this.data = res.data || [];
          this.total = res.data?.length || 0;
          this.page = clampPage(this.page, this.totalPages);
        } else {
          this.error = res.message || '查询失败';
          this.data = [];
          this.total = 0;
        }
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
        this.loading = false;
        this.data = [];
        this.total = 0;
      });
    }
  };

  delete = async (id: number): Promise<boolean> => {
    try {
      const res = await tradeService.delete(id);
      return runInAction(() => {
        if (res.success) {
          this.data = this.data.filter((d) => d.id !== id);
          this.total = this.data.length;
          this.page = clampPage(this.page, this.totalPages);
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
    const accessors: Record<TradeSortField, (item: StockTradeResponse) => string | number | Date | null | undefined> = {
      tradeDate: item => new Date(item.tradeDate),
      stockCode: item => item.stockCode,
      stockName: item => item.stockName,
      board: item => item.board,
      status: item => (item.isLiquidated || item.positionQuantity <= 0 ? 0 : 1),
      buyPrice: item => item.buyPrice,
      buyQuantity: item => item.buyQuantity,
      sellPrice: item => item.sellPrice,
      sellQuantity: item => item.sellQuantity,
      positionPnL: item => item.positionPnL,
      cumulativePnL: item => item.cumulativePnL,
      tradeNote: item => item.tradeNote,
    };

    return sortItemsBy(this.data, [
      { getValue: accessors[this.sortField], order: this.sortOrder },
      { getValue: item => new Date(item.tradeDate), order: 'desc' },
      { getValue: item => item.stockCode, order: 'asc' },
      { getValue: item => item.id, order: 'desc' },
    ]);
  }

  get displayedData(): StockTradeResponse[] {
    return paginateItems(this.sortedData, this.page, this.pageSize);
  }

  get totalPages(): number {
    return getTotalPages(this.total, this.pageSize);
  }

  toggleSort = (field: TradeSortField) => {
    const nextState = nextSortState(this.sortField, this.sortOrder, field);
    this.sortField = nextState.field;
    this.sortOrder = nextState.order;
    this.page = 1;
  };

  setFilters = (filters: { keyword?: string; tradeDate?: string; board?: string }) => {
    if (filters.keyword !== undefined) this.keyword = filters.keyword;
    if (filters.tradeDate !== undefined) this.tradeDate = filters.tradeDate;
    if (filters.board !== undefined) this.board = filters.board;
    this.page = 1;
  };

  setPage = (p: number) => {
    this.page = clampPage(p, this.totalPages);
  };

  clearError = () => {
    this.error = null;
  };
}

export const tradeListStore = new TradeListStore();
