import { makeAutoObservable, runInAction } from 'mobx';
import { accountService } from '../services/AccountService';
import { bankFlowService } from '../services/BankFlowService';
import { tradeService } from '../services/TradeService';
import type { AccountDailyResponse } from '../services/AccountService';
import type { BankFlowResponse } from '../services/BankFlowService';
import type { StockTradeResponse } from '../services/TradeService';
import { clampPage, getTotalPages, nextSortState, paginateItems, sortItemsBy, type SortOrder } from '../utils/table';

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
  isLiquidated?: boolean;
  // 通用
  remark?: string;
  raw: AccountDailyResponse | BankFlowResponse | StockTradeResponse;
}

export type UnifiedSortField =
  | 'date'
  | 'type'
  | 'remark'
  | 'totalAssets'
  | 'positionValue'
  | 'availableFunds'
  | 'dailyPnL'
  | 'flowType'
  | 'amount'
  | 'stockCode'
  | 'stockName'
  | 'board'
  | 'status'
  | 'tradePositionValue'
  | 'positionQuantity';

export interface UnifiedTradeDaySummary {
  date: string;
  totalAssets: number;
  dailyPnL: number;
}

export class UnifiedListStore {
  data: UnifiedListItem[] = [];
  tradeDaySummaries: Record<string, UnifiedTradeDaySummary> = {};
  loading = false;
  error: string | null = null;
  startDate = '';
  endDate = '';
  keyword = '';
  sortField: UnifiedSortField = 'date';
  sortOrder: SortOrder = 'desc';
  page = 1;
  pageSize = 20;
  activeType: UnifiedActiveType = 'account'; // 当前选中的列表类型

  constructor() {
    makeAutoObservable(this);
  }

  fetch = async () => {
    this.loading = true;
    this.error = null;
    try {
      let items: UnifiedListItem[] = [];
      let tradeDaySummaries: Record<string, UnifiedTradeDaySummary> = {};

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
            tradeDate: this.startDate || undefined,
            board: '',
            page: 1,
            pageSize: 5000,
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
                isLiquidated: d.isLiquidated,
                remark: d.tradeNote,
                raw: d,
              });
            }
          }
          this.data = items;
          this.tradeDaySummaries = this.buildTradeDaySummaries(accountRes.data);
          this.page = clampPage(this.page, this.totalPages);
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
          const [accountRes, tradeRes] = await Promise.all([
            accountService.getByDateRange(
              this.startDate || undefined,
              this.endDate || undefined
            ),
            tradeService.query({
              tradeDate: this.startDate || undefined,
              board: '',
              page: 1,
              pageSize: 5000,
            }),
          ]);

          if (tradeRes.success && tradeRes.data) {
            items = tradeRes.data
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
                isLiquidated: d.isLiquidated,
                remark: d.tradeNote,
                raw: d,
              }));
          }

          tradeDaySummaries = this.buildTradeDaySummaries(accountRes.success ? accountRes.data : undefined);
        }

        runInAction(() => {
          this.data = items;
          this.tradeDaySummaries = this.activeType === 'trade' ? tradeDaySummaries : {};
          this.page = clampPage(this.page, this.totalPages);
          this.loading = false;
        });
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
        this.loading = false;
        this.data = [];
        this.tradeDaySummaries = {};
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

  deleteMany = async (items: Array<{ type: UnifiedItemType; id: number }>): Promise<{
    successCount: number;
    failCount: number;
  }> => {
    this.loading = true;
    this.error = null;

    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      const success = await this.delete(item.type, item.id);
      if (success) {
        successCount += 1;
      } else {
        failCount += 1;
      }
    }

    runInAction(() => {
      this.loading = false;
    });

    return { successCount, failCount };
  };

  get filteredData(): UnifiedListItem[] {
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

        return item.remark?.toLowerCase().includes(kw) ?? false;
      });
    }

    return filtered;
  }

  get sortedData(): UnifiedListItem[] {
    const accessors: Record<UnifiedSortField, (item: UnifiedListItem) => string | number | Date | null | undefined> = {
      date: item => new Date(item.date),
      type: item => item.type,
      remark: item => item.remark,
      totalAssets: item => item.totalAssets,
      positionValue: item => item.positionValue,
      availableFunds: item => item.availableFunds,
      dailyPnL: item => item.dailyPnL,
      flowType: item => item.flowType,
      amount: item => item.amount,
      stockCode: item => item.stockCode,
      stockName: item => item.stockName,
      board: item => item.board,
      status: item => (item.isLiquidated || (item.positionQuantity ?? 0) <= 0 ? 0 : 1),
      tradePositionValue: item => item.tradePositionValue,
      positionQuantity: item => item.positionQuantity,
    };

    const descriptors = this.activeType === 'trade' && this.sortField !== 'date'
      ? [
        { getValue: (item: UnifiedListItem) => new Date(item.date), order: 'desc' as const },
        { getValue: accessors[this.sortField], order: this.sortOrder },
        { getValue: (item: UnifiedListItem) => item.stockCode, order: 'asc' as const },
        { getValue: (item: UnifiedListItem) => item.id, order: 'desc' as const },
      ]
      : [
        { getValue: accessors[this.sortField], order: this.sortOrder },
        { getValue: (item: UnifiedListItem) => new Date(item.date), order: 'desc' as const },
        { getValue: (item: UnifiedListItem) => item.id, order: 'desc' as const },
      ];

    return sortItemsBy(this.filteredData, descriptors);
  }

  get displayedData(): UnifiedListItem[] {
    return paginateItems(this.sortedData, this.page, this.pageSize);
  }

  get totalCount(): number {
    return this.filteredData.length;
  }

  get totalPages(): number {
    return getTotalPages(this.totalCount, this.pageSize);
  }

  toggleSort = (field: UnifiedSortField) => {
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

  setKeyword = (kw: string) => {
    this.keyword = kw;
    this.page = 1;
  };

  setPage = (p: number) => {
    this.page = clampPage(p, this.totalPages);
  };

  setActiveType = (type: UnifiedActiveType) => {
    this.activeType = type;
    this.page = 1;
    this.fetch();
  };

  clearError = () => {
    this.error = null;
  };

  private buildTradeDaySummaries(accounts?: AccountDailyResponse[]): Record<string, UnifiedTradeDaySummary> {
    if (!accounts?.length) {
      return {};
    }

    return accounts.reduce<Record<string, UnifiedTradeDaySummary>>((summaries, account) => {
      const date = account.date?.split('T')[0] ?? '';
      if (!date) {
        return summaries;
      }

      summaries[date] = {
        date,
        totalAssets: account.totalAssets,
        dailyPnL: account.dailyPnL,
      };
      return summaries;
    }, {});
  }
}

export const unifiedListStore = new UnifiedListStore();
