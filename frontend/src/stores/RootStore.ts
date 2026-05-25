import { weatherStore } from './WeatherStore';

export class RootStore {
  weatherStore = weatherStore;
}

export const rootStore = new RootStore();