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
import { messageStore } from './MessageStore';

export class RootStore {
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
  messageStore = messageStore;
}

export const rootStore = new RootStore();
