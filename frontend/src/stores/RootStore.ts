import { weatherStore } from './WeatherStore';
import { authStore } from './AuthStore';
import { dashboardStore } from './DashboardStore';
import { accountEntryStore } from './AccountEntryStore';
import { bankFlowEntryStore } from './BankFlowEntryStore';
import { tradeEntryStore } from './TradeEntryStore';
import { accountListStore } from './AccountListStore';
import { bankFlowListStore } from './BankFlowListStore';
import { tradeListStore } from './TradeListStore';

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
}

export const rootStore = new RootStore();