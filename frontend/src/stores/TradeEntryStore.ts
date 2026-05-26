import { makeAutoObservable, runInAction } from 'mobx';
import { tradeService } from '../services/TradeService';
import type { StockTradeRequest } from '../services/TradeService';

export class TradeEntryStore {
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  submit = async (request: StockTradeRequest) => {
    this.loading = true;
    this.error = null;
    this.successMessage = null;
    try {
      const result = await tradeService.create(request);
      runInAction(() => {
        if (result.success) {
          this.successMessage = result.message || '交易记录录入成功';
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

  clearMessages = () => {
    this.error = null;
    this.successMessage = null;
  };
}

export const tradeEntryStore = new TradeEntryStore();