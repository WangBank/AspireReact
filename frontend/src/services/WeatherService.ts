import type { WeatherForecast } from '../stores/WeatherStore';

const API_BASE = '/api';

export class WeatherService {
  async getForecasts(): Promise<WeatherForecast[]> {
    const response = await fetch(`${API_BASE}/weatherforecast`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

export const weatherService = new WeatherService();