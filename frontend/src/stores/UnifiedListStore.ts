import { makeAutoObservable, runInAction } from 'mobx';
import { accountService } from '../services/AccountService';
import { bankFlowService } from '../services/BankFlowService';
import { tradeService } from '../services/TradeService';
import type { AccountDailyResponse } from '../services/AccountService';
import type { BankFlowResponse } from '../services/BankFlowService';
import type { StockTradeResponse } from '../services/TradeService';

export type UnifiedItemType = 'account' | 'bankflow' | 'trade';

export type UnifiedActiveType = UnifiedItemType | 'all';

export interface UnifiedListItem {
  id: number;
  type: UnifiedItemType;
  date: string;           // 统一日期字段
  // 账户资金
  totalAssets?: number;
  dailyPnL?: number;
  positionValue?: number;
  availableFunds?: number;
  // 银证流水
  flowType?: string;
  amount?: number;
  // 交易：与 UnifiedEntryPage 表单字段对齐
  stockCode?: string;
  stockName?: string;
  board?: string;
  tradePositionValue?: number;  // 持仓市值（表单 positionValue）
  positionQuantity?: number;    // 持仓数量（股）
  costPrice?: number;            // 成本价
  currentPrice?: number;         // 现价
  cumulativePnL?: number;       // 累计盈亏
  // 通用
  remark?: string;
  raw: AccountDailyResponse | BankFlowResponse | StockTradeResponse;
}

export type UnifiedSortField = 'date' | 'type';
export type UnifiedSortOrder = 'asc' | 'desc';

export class UnifiedListStore {
  data: UnifiedListItem[] = [];
  loading = false;
  error: string | null = null;
  startDate = '';
  endDate = '';
  keyword = '';
  sortField: UnifiedSortField = 'date';
  sortOrder: UnifiedSortOrder = 'desc';
  page = 1;
  pageSize = 20;
  totalPages = 1;
  activeType: UnifiedActiveType = 'account'; // 当前选中的列表类型

  constructor() {
    makeAutoObservable(this);
  }

  fetch = async () => {
    this.loading = true;
    this.error = null;
    try {
      let items: UnifiedListItem[] = [];

      if (this.activeType === 'all') {
        // 全部：并行加载三种数据
        const [accountRes, bankFlowRes, tradeRes] = await Promise.all([
          accountService.getByDateRange(
            this.startDate || undefined,
            this.endDate || undefined
          ),
          bankFlowService.getByDateRange(
            this.startDate || undefined,
            this.endDate || undefined
          ),
          tradeService.query({
            stockCode: this.keyword || undefined,
            tradeDate: this.startDate || undefined,
            board: '',
            page: 1,
            pageSize: 1000,
          }),
        ]);
        runInAction(() => {
          const fmtDate = (d: string) => d?.split('T')[0] ?? '';

          if (accountRes.success && accountRes.data) {
            for (const d of accountRes.data) {
              items.push({
                id: d.id,
                type: 'account',
                date: fmtDate(d.date),
                totalAssets: d.totalAssets,
                dailyPnL: d.dailyPnL,
                positionValue: d.positionValue,
                availableFunds: d.availableFunds,
                remark: d.remark,
                raw: d,
              });
            }
          }

          if (bankFlowRes.success && bankFlowRes.data) {
            for (const d of bankFlowRes.data) {
              items.push({
                id: d.id,
                type: 'bankflow',
                date: fmtDate(d.date),
                flowType: d.flowType,
                amount: d.amount,
                remark: d.remark,
                raw: d,
              });
            }
          }

          if (tradeRes.success && tradeRes.data) {
            for (const d of tradeRes.data) {
              if (this.endDate && d.tradeDate > this.endDate) continue;
              items.push({
                id: d.id,
                type: 'trade',
                date: fmtDate(d.tradeDate),
                stockCode: d.stockCode,
                stockName: d.stockName,
                board: d.board,
                tradePositionValue: d.positionPnL,
                positionQuantity: d.positionQuantity,
                costPrice: d.costPrice,
                currentPrice: d.currentPrice,
                cumulativePnL: d.cumulativePnL,
                dailyPnL: d.dailyPnL,
                remark: d.tradeNote,
                raw: d,
              });
            }
          }
          this.data = items;
          this.loading = false;
        });
      } else {
        // 只加载当前选中类型的数据
        const fmtDate = (d: string) => d?.split('T')[0] ?? '';
        
        if (this.activeType === 'account') {
          const res = await accountService.getByDateRange(
            this.startDate || undefined,
            this.endDate || undefined
          );
          if (res.success && res.data) {
            items = res.data.map(d => ({
              id: d.id,
              type: 'account' as const,
              date: fmtDate(d.date),
              totalAssets: d.totalAssets,
              dailyPnL: d.dailyPnL,
              positionValue: d.positionValue,
              availableFunds: d.availableFunds,
              remark: d.remark,
              raw: d,
            }));
          }
        } else if (this.activeType === 'bankflow') {
          const res = await bankFlowService.getByDateRange(
            this.startDate || undefined,
            this.endDate || undefined
          );
          if (res.success && res.data) {
            items = res.data.map(d => ({
              id: d.id,
              type: 'bankflow' as const,
              date: fmtDate(d.date),
              flowType: d.flowType,
              amount: d.amount,
              remark: d.remark,
              raw: d,
            }));
          }
        } else if (this.activeType === 'trade') {
          const res = await tradeService.query({
            stockCode: this.keyword || undefined,
            tradeDate: this.startDate || undefined,
            board: '',
            page: 1,
            pageSize: 1000,
          });
          if (res.success && res.data) {
            items = res.data
              .filter(d => !(this.endDate && d.tradeDate > this.endDate))
              .map(d => ({
                id: d.id,
                type: 'trade' as const,
                date: fmtDate(d.tradeDate),
                stockCode: d.stockCode,
                stockName: d.stockName,
                board: d.board,
                tradePositionValue: d.positionPnL,
                positionQuantity: d.positionQuantity,
                costPrice: d.costPrice,
                currentPrice: d.currentPrice,
                cumulativePnL: d.cumulativePnL,
                dailyPnL: d.dailyPnL,
                tradeNote: d.tradeNote,
                remark: d.tradeNote,
                raw: d,
              }));
          }
        }

        runInAction(() => {
          this.data = items;
          this.loading = false;
        });
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
        this.loading = false;
        this.data = [];
      });
    }
  };

  delete = async (type: UnifiedItemType, id: number): Promise<boolean> => {
    try {
      let res: { success: boolean; message?: string };
      if (type === 'account') {
        res = await accountService.delete(id);
      } else if (type === 'bankflow') {
        res = await bankFlowService.delete(id);
      } else {
        res = await tradeService.delete(id);
      }
      return runInAction(() => {
        if (res.success) {
          this.data = this.data.filter((d) => d.id !== id || d.type !== type);
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

  get sortedData(): UnifiedListItem[] {
    const { sortField, sortOrder } = this;
    return [...this.data].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if (sortField === 'date') {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else if (sortField === 'type') {
        aVal = a.type;
        bVal = b.type;
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get displayedData(): UnifiedListItem[] {
    let filtered = this.sortedData;
    if (this.keyword) {
      const kw = this.keyword.toLowerCase();
      filtered = filtered.filter((item) => {
        if (item.type === 'trade') {
          return (
            item.stockCode?.toLowerCase().includes(kw) ||
            item.stockName?.toLowerCase().includes(kw) ||
            item.board?.toLowerCase().includes(kw)
          );
        }
        if (item.remark) return item.remark.toLowerCase().includes(kw);
        return false;
      });
    }
    const start = (this.page - 1) * this.pageSize;
    return filtered.slice(start, start + this.pageSize);
  }

  get totalCount(): number {
    let filtered = this.data;
    if (this.keyword) {
      const kw = this.keyword.toLowerCase();
      filtered = filtered.filter((item) => {
        if (item.type === 'trade') {
          return (
            item.stockCode?.toLowerCase().includes(kw) ||
            item.stockName?.toLowerCase().includes(kw) ||
            item.board?.toLowerCase().includes(kw)
          );
        }
        if (item.remark) return item.remark.toLowerCase().includes(kw);
        return false;
      });
    }
    return filtered.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  toggleSort = (field: UnifiedSortField) => {
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

  setKeyword = (kw: string) => {
    this.keyword = kw;
    this.page = 1;
  };

  setPage = (p: number) => {
    this.page = Math.max(1, Math.min(p, this.totalPages));
  };

  setActiveType = (type: UnifiedActiveType) => {
    this.activeType = type;
    this.page = 1;
    this.fetch();
  };

  clearError = () => {
    this.error = null;
  };
}

export const unifiedListStore = new UnifiedListStore();
