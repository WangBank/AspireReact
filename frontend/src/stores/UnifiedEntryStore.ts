import { makeAutoObservable, runInAction } from 'mobx';
import { accountService } from '../services/AccountService';
import { bankFlowService } from '../services/BankFlowService';
import { tradeService } from '../services/TradeService';
import type { BatchTradeResult } from '../services/TradeService';
import type { AccountDailyRequest } from '../services/AccountService';
import type { BankFlowRequest } from '../services/BankFlowService';
import type { StockTradeRequest } from '../services/TradeService';

export class UnifiedEntryStore {
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  batchResult: BatchTradeResult | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  submitAccount = async (request: AccountDailyRequest): Promise<boolean> => {
    this.loading = true;
    this.error = null;
    this.successMessage = null;
    try {
      const result = await accountService.create(request);
      runInAction(() => {
        if (result.success) {
          this.successMessage = result.message || '账户资金录入成功';
        } else {
          this.error = result.message || '录入失败';
        }
        this.loading = false;
      });
      return result.success;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误，请稍后重试';
        this.loading = false;
      });
      return false;
    }
  };

  submitBankFlow = async (request: BankFlowRequest): Promise<boolean> => {
    this.loading = true;
    this.error = null;
    this.successMessage = null;
    try {
      const result = await bankFlowService.create(request);
      runInAction(() => {
        if (result.success) {
          this.successMessage = result.message || '银证流水录入成功';
        } else {
          this.error = result.message || '录入失败';
        }
        this.loading = false;
      });
      return result.success;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误，请稍后重试';
        this.loading = false;
      });
      return false;
    }
  };

  submitTrades = async (trades: StockTradeRequest[]): Promise<boolean> => {
    this.loading = true;
    this.error = null;
    this.successMessage = null;
    this.batchResult = null;
    try {
      const result = await tradeService.batchCreate({ trades });
      runInAction(() => {
        this.batchResult = result;
        if (result.success) {
          this.successMessage = result.message;
        } else {
          this.error = result.message;
        }
        this.loading = false;
      });
      return result.success;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误，请稍后重试';
        this.loading = false;
      });
      return false;
    }
  };

  submitAll = async (
    account: AccountDailyRequest | null,
    bankFlow: BankFlowRequest | null,
    trades: StockTradeRequest[]
  ): Promise<{ account: boolean; bankFlow: boolean; trades: boolean }> => {
    this.loading = true;
    this.error = null;
    this.successMessage = null;
    this.batchResult = null;

    const results = { account: false, bankFlow: false, trades: false };

    try {
      if (account) {
        const r = await accountService.create(account);
        runInAction(() => {
          if (r.success) {
            results.account = true;
          } else {
            this.error = (this.error ? this.error + '\n' : '') + `账户资金：${r.message}`;
          }
        });
      }

      if (bankFlow) {
        const r = await bankFlowService.create(bankFlow);
        runInAction(() => {
          if (r.success) {
            results.bankFlow = true;
          } else {
            this.error = (this.error ? this.error + '\n' : '') + `银证流水：${r.message}`;
          }
        });
      }

      if (trades.length > 0) {
        const r = await tradeService.batchCreate({ trades });
        runInAction(() => {
          this.batchResult = r;
          if (r.success) {
            results.trades = true;
          } else {
            this.error = (this.error ? this.error + '\n' : '') + `交易记录：${r.message}`;
          }
        });
      }

      runInAction(() => {
        const anySuccess = results.account || results.bankFlow || results.trades;
        if (anySuccess) {
          const parts: string[] = [];
          if (results.account) parts.push('账户资金');
          if (results.bankFlow) parts.push('银证流水');
          if (results.trades) parts.push(`交易记录（成功${this.batchResult?.successCount || 0}条）`);
          this.successMessage = `录入成功：${parts.join('、')}`;
        }
        this.loading = false;
      });

      return results;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误，请稍后重试';
        this.loading = false;
      });
      return results;
    }
  };

  clearMessages = () => {
    this.error = null;
    this.successMessage = null;
    this.batchResult = null;
  };
}

export const unifiedEntryStore = new UnifiedEntryStore();
