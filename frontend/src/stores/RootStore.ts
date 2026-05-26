import { weatherStore } from './WeatherStore';
import { authStore } from './AuthStore';
import { dashboardStore } from './DashboardStore';
import { accountEntryStore } from './AccountEntryStore';
import { bankFlowEntryStore } from './BankFlowEntryStore';
import { tradeEntryStore } from './TradeEntryStore';

export class RootStore {
  weatherStore = weatherStore;
  authStore = authStore;
  dashboardStore = dashboardStore;
  accountEntryStore = accountEntryStore;
  bankFlowEntryStore = bankFlowEntryStore;
  tradeEntryStore = tradeEntryStore;
}

export const rootStore = new RootStore();