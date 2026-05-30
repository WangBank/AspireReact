const API_BASE = '/api/portfolio-import';

export interface PortfolioImportAccount {
  totalAssets: number;
  positionValue: number;
  availableFunds: number;
  dailyPnL: number;
}

export interface PortfolioImportPosition {
  stockCode: string;
  stockName: string;
  board: string;
  buyPrice: number;
  buyQuantity: number;
  sellPrice: number;
  sellQuantity: number;
  positionQuantity: number;
  costPrice: number;
  currentPrice: number;
  positionPnL: number;
  cumulativePnL: number;
  dailyPnL: number;
  marketValue: number;
  isLiquidated: boolean;
}

export interface PortfolioImportResponse {
  account: PortfolioImportAccount | null;
  positions: PortfolioImportPosition[];
  warnings: string[];
}

interface PortfolioImportApiResponse {
  success: boolean;
  message: string;
  data?: PortfolioImportResponse;
}

export class ImageImportService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async importScreenshot(file: File, importDate?: string): Promise<PortfolioImportResponse> {
    const formData = new FormData();
    formData.append('image', file);
    if (importDate) {
      formData.append('importDate', importDate);
    }

    const response = await fetch(`${API_BASE}/screenshot`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    const json: PortfolioImportApiResponse = await response.json();
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '图片识别失败');
    }

    return json.data;
  }
}

export const imageImportService = new ImageImportService();
