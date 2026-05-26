import { makeAutoObservable, runInAction } from 'mobx';
import { bankFlowService } from '../services/BankFlowService';
import type { BankFlowRequest } from '../services/BankFlowService';

export class BankFlowEntryStore {
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  submit = async (request: BankFlowRequest) => {
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

  clearMessages = () => {
    this.error = null;
    this.successMessage = null;
  };
}

export const bankFlowEntryStore = new BankFlowEntryStore();