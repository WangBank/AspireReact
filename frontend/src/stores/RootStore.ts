import { weatherStore } from './WeatherStore';
import { authStore } from './AuthStore';
import { dashboardStore } from './DashboardStore';
import { accountEntryStore } from './AccountEntryStore';
import { bankFlowEntryStore } from './BankFlowEntryStore';
import { tradeEntryStore } from './TradeEntryStore';
import { accountListStore } from './AccountListStore';
import { bankFlowListStore } from './BankFlowListStore';
import { tradeListStore } from './TradeListStore';
import { statisticsStore } from './StatisticsStore';
import { notesStore } from './NotesStore';
import { configStore } from './ConfigStore';

export class RootStore {
  weatherStore = weatherStore;
  authStore = authStore;
  dashboardStore = dashboardStore;
  accountEntryStore = accountEntryStore;
  bankFlowEntryStore = bankFlowEntryStore;
  tradeEntryStore = tradeEntryStore;
  accountListStore = accountListStore;
  bankFlowListStore = bankFlowListStore;
  tradeListStore = tradeListStore;
  statisticsStore = statisticsStore;
  notesStore = notesStore;
  configStore = configStore;
}

export const rootStore = new RootStore();