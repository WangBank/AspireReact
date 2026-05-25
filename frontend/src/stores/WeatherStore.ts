import { makeAutoObservable, runInAction } from 'mobx';
import { weatherService } from '../services/WeatherService';

export interface WeatherForecast {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary: string;
}

export class WeatherStore {
  forecasts: WeatherForecast[] = [];
  loading = false;
  error: string | null = null;
  useCelsius = false;

  constructor() {
    makeAutoObservable(this);
    this.initialize();
  }

  private initialize() {
    if (this.formattedForecasts.length === 0) {
      this.fetchWeatherForecast();
    }
  }

  setUseCelsius = (useCelsius: boolean) => {
    this.useCelsius = useCelsius;
  };

  fetchWeatherForecast = async () => {
    this.loading = true;
    this.error = null;
    console.log('Fetching weather forecasts...');

    try {
      const data = await weatherService.getForecasts();
      runInAction(() => {
        this.forecasts = data;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to fetch weather data';
        this.loading = false;
      });
    }
  };

  get formattedForecasts() {
    return this.forecasts.map(forecast => ({
      ...forecast,
      temperature: this.useCelsius ? forecast.temperatureC : forecast.temperatureF,
    }));
  }

  private formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

export const weatherStore = new WeatherStore();