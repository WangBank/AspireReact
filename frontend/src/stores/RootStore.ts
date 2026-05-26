import { weatherStore } from './WeatherStore';
import { authStore } from './AuthStore';

export class RootStore {
  weatherStore = weatherStore;
  authStore = authStore;
}

export const rootStore = new RootStore();