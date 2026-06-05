import { makeAutoObservable, runInAction } from 'mobx';
import { configService } from '../services/ConfigService';

export class ConfigStore {
  tonghuashunLinkPrefix = '';
  sensitiveWordsText = '';
  sensitiveWordCount = 0;
  sensitiveWordsUpdatedAt: string | null = null;
  sensitiveWordsUpdatedByUsername: string | null = null;
  loading = false;
  error: string | null = null;
  saveSuccess = false;

  constructor() {
    makeAutoObservable(this);
  }

  /** 从后端加载配置 */
  fetch = async () => {
    this.loading = true;
    this.error = null;
    try {
      const data = await configService.get();
      runInAction(() => {
        this.tonghuashunLinkPrefix = data.tonghuashunLinkPrefix;
        this.sensitiveWordsText = data.sensitiveWordsText;
        this.sensitiveWordCount = data.sensitiveWordCount;
        this.sensitiveWordsUpdatedAt = data.sensitiveWordsUpdatedAt;
        this.sensitiveWordsUpdatedByUsername = data.sensitiveWordsUpdatedByUsername;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '加载配置失败';
        this.loading = false;
      });
    }
  };

  /** 更新同花顺链接前缀 */
  updateSettings = async (newPrefix: string, sensitiveWordsText: string) => {
    this.loading = true;
    this.error = null;
    this.saveSuccess = false;
    try {
      const data = await configService.update(newPrefix, sensitiveWordsText);
      runInAction(() => {
        this.tonghuashunLinkPrefix = data.tonghuashunLinkPrefix;
        this.sensitiveWordsText = data.sensitiveWordsText;
        this.sensitiveWordCount = data.sensitiveWordCount;
        this.sensitiveWordsUpdatedAt = data.sensitiveWordsUpdatedAt;
        this.sensitiveWordsUpdatedByUsername = data.sensitiveWordsUpdatedByUsername;
        this.saveSuccess = true;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '更新配置失败';
        this.loading = false;
      });
    }
  };

  clearError = () => {
    this.error = null;
  };

  clearSaveSuccess = () => {
    this.saveSuccess = false;
  };
}

export const configStore = new ConfigStore();
