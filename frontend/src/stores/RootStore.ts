import { weatherStore } from './WeatherStore';
import { authStore } from './AuthStore';
import { dashboardStore } from './DashboardStore';

export class RootStore {
  weatherStore = weatherStore;
  authStore = authStore;
  dashboardStore = dashboardStore;
}

export const rootStore = new RootStore();