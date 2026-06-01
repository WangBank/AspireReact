import type { AccountDailyRequest } from './AccountService';
import type { BankFlowRequest } from './BankFlowService';
import type { PortfolioImportResponse } from './ImageImportService';
import type { StockTradeRequest } from './TradeService';
import { getAuthToken } from '../utils/authToken';

const API_BASE = '/api/portfolio-import';

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PortfolioImportAuditListItem {
  id: number;
  createdAt: string;
  importDate?: string | null;
  recognizedDate?: string | null;
  sourceFileName: string;
  contentType: string;
  fileSize: number;
  parseSuccess: boolean;
  parseMessage: string;
  positionCount: number;
  warningCount: number;
  saveAttempted: boolean;
  saveStatus?: string | null;
  savedAccount: boolean;
  savedBankFlow: boolean;
  savedTrades: boolean;
  requestedTradeCount: number;
  savedTradeCount: number;
  saveMessage?: string | null;
}

export interface PortfolioImportAuditFinalPayload {
  finalAccount?: AccountDailyRequest | null;
  finalBankFlow?: BankFlowRequest | null;
  finalTrades: StockTradeRequest[];
}

export interface PortfolioImportAuditSaveResult {
  saveSucceeded: boolean;
  savedAccount: boolean;
  savedBankFlow: boolean;
  savedTrades: boolean;
  requestedTradeCount: number;
  savedTradeCount: number;
  saveStatus?: string | null;
  saveMessage?: string | null;
  saveErrors: string[];
  saveCompletedAt?: string | null;
}

export interface PortfolioImportAuditDetail extends PortfolioImportAuditListItem {
  hasImage: boolean;
  recognizedText?: string | null;
  recognizedPayload?: PortfolioImportResponse | null;
  finalPayload?: PortfolioImportAuditFinalPayload | null;
  saveResult?: PortfolioImportAuditSaveResult | null;
}

export interface PortfolioImportAuditFinalizeRequest {
  finalAccount?: AccountDailyRequest | null;
  finalBankFlow?: BankFlowRequest | null;
  finalTrades: StockTradeRequest[];
  saveSucceeded: boolean;
  savedAccount: boolean;
  savedBankFlow: boolean;
  savedTrades: boolean;
  requestedTradeCount: number;
  savedTradeCount: number;
  saveMessage?: string;
  saveErrors: string[];
}

interface AuditListApiResponse {
  success: boolean;
  message: string;
  data?: PagedResult<PortfolioImportAuditListItem>;
}

interface AuditDetailApiResponse {
  success: boolean;
  message: string;
  data?: PortfolioImportAuditDetail;
}

interface BasicApiResponse {
  success: boolean;
  message: string;
}

export class PortfolioImportAuditService {
  private getAuthHeaders(contentType = true): HeadersInit {
    const token = getAuthToken();
    return {
      ...(contentType ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async getAudits(params: {
    page?: number;
    pageSize?: number;
    saveStatus?: string;
  }): Promise<PagedResult<PortfolioImportAuditListItem>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', String(params.page));
    if (params.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params.saveStatus) searchParams.append('saveStatus', params.saveStatus);

    const response = await fetch(`${API_BASE}/audits?${searchParams.toString()}`, {
      headers: this.getAuthHeaders(false),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json: AuditListApiResponse = await response.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || '获取识别审计列表失败');
    }

    return json.data;
  }

  async getAuditDetail(id: number): Promise<PortfolioImportAuditDetail> {
    const response = await fetch(`${API_BASE}/audits/${id}`, {
      headers: this.getAuthHeaders(false),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json: AuditDetailApiResponse = await response.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || '获取识别审计详情失败');
    }

    return json.data;
  }

  async getAuditImageBlob(id: number): Promise<Blob> {
    const response = await fetch(`${API_BASE}/audits/${id}/image`, {
      headers: this.getAuthHeaders(false),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.blob();
  }

  async finalize(id: number, request: PortfolioImportAuditFinalizeRequest): Promise<void> {
    const response = await fetch(`${API_BASE}/audits/${id}/finalize`, {
      method: 'POST',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let message = `HTTP error! status: ${response.status}`;
      try {
        const json: BasicApiResponse = await response.json();
        message = json.message || message;
      } catch {
        // ignore response parse errors
      }

      throw new Error(message);
    }

    const json: BasicApiResponse = await response.json();
    if (!json.success) {
      throw new Error(json.message || '回填识别审计结果失败');
    }
  }
}

export const portfolioImportAuditService = new PortfolioImportAuditService();
