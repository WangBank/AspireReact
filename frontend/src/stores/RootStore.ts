import { weatherStore } from './WeatherStore';
import { authStore } from './AuthStore';
import { dashboardStore } from './DashboardStore';
import { accountEntryStore } from './AccountEntryStore';
import { bankFlowEntryStore } from './BankFlowEntryStore';
import { tradeEntryStore } from './TradeEntryStore';
import { unifiedEntryStore } from './UnifiedEntryStore';
import { accountListStore } from './AccountListStore';
import { bankFlowListStore } from './BankFlowListStore';
import { tradeListStore } from './TradeListStore';
import { statisticsStore } from './StatisticsStore';
import { notesStore } from './NotesStore';
import { unifiedListStore } from './UnifiedListStore';
import { configStore } from './ConfigStore';
import { stockLeaderboardStore } from './StockLeaderboardStore';

export class RootStore {
  weatherStore = weatherStore;
  authStore = authStore;
  dashboardStore = dashboardStore;
  accountEntryStore = accountEntryStore;
  bankFlowEntryStore = bankFlowEntryStore;
  tradeEntryStore = tradeEntryStore;
  unifiedEntryStore = unifiedEntryStore;
  accountListStore = accountListStore;
  bankFlowListStore = bankFlowListStore;
  tradeListStore = tradeListStore;
  unifiedListStore = unifiedListStore;
  statisticsStore = statisticsStore;
  notesStore = notesStore;
  configStore = configStore;
  stockLeaderboardStore = stockLeaderboardStore;
}

export const rootStore = new RootStore();
