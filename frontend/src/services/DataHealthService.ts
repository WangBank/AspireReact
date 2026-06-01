import { getAuthToken } from '../utils/authToken';

const API_BASE = '/api/data-health';

export interface DataHealthFinding {
  severity: 'error' | 'warning' | 'info';
  category: string;
  businessDate?: string | null;
  title: string;
  description: string;
  stockCode?: string | null;
  stockName?: string | null;
  currentValue?: number | null;
  expectedValue?: number | null;
  difference?: number | null;
  suggestedAction?: string | null;
}

export interface DataHealthReport {
  generatedAt: string;
  totalFindings: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  accountDayCount: number;
  tradeRecordCount: number;
  tradeDayCount: number;
  bankFlowDayCount: number;
  auditCount: number;
  pendingAuditCount: number;
  failedAuditCount: number;
  findings: DataHealthFinding[];
}

interface DataHealthApiResponse {
  success: boolean;
  message: string;
  data?: DataHealthReport;
}

export class DataHealthService {
  private getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getReport(): Promise<DataHealthReport> {
    const response = await fetch(`${API_BASE}/report`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json: DataHealthApiResponse = await response.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || '获取数据体检报告失败');
    }

    return json.data;
  }
}

export const dataHealthService = new DataHealthService();
