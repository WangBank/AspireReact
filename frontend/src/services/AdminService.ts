import { getAuthToken } from '../utils/authToken';
import type { ReflectionContent } from './ReflectionService';

const API_BASE = '/api/admin';

export interface AdminSummary {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  totalAccounts: number;
  totalBankFlows: number;
  totalTrades: number;
  totalAudits: number;
  lastUserLoginAt: string | null;
  lastAuditCreatedAt: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  performance: AdminUserPerformance;
}

export interface AdminUserPerformance {
  latestDataDate: string | null;
  accountRecordCount: number;
  bankFlowRecordCount: number;
  tradeRecordCount: number;
  currentTotalAssets: number;
  latestDailyPnL: number;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  netBankFlow: number;
  winTrades: number;
  loseTrades: number;
  totalTrades: number;
  winRate: number;
}

export interface AdminBatchOperationResult {
  updatedCount: number;
  userIds: number[];
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface DatabaseExportResult {
  blob: Blob;
  fileName: string;
  tempFilePath: string | null;
}

export interface DatabaseRestoreResult {
  fileName: string;
  database: string;
  fileSizeBytes: number;
  restoredAt: string;
}

export class AdminService {
  private getAuthHeaders(contentType = true): HeadersInit {
    const token = getAuthToken();
    return {
      ...(contentType ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async getSummary(): Promise<AdminSummary> {
    const response = await fetch(`${API_BASE}/summary`, {
      headers: this.getAuthHeaders(false),
    });
    const json: ApiResponse<AdminSummary> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '加载管理员概览失败');
    }

    return json.data;
  }

  async getUsers(): Promise<AdminUser[]> {
    const response = await fetch(`${API_BASE}/users`, {
      headers: this.getAuthHeaders(false),
    });
    const json: ApiResponse<AdminUser[]> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '加载用户列表失败');
    }

    return json.data;
  }

  async updateUserStatus(id: number, isActive: boolean): Promise<AdminUser> {
    const response = await fetch(`${API_BASE}/users/${id}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ isActive }),
    });
    const json: ApiResponse<AdminUser> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '更新用户状态失败');
    }

    return json.data;
  }

  async updateUserRole(id: number, role: 'Admin' | 'User'): Promise<AdminUser> {
    const response = await fetch(`${API_BASE}/users/${id}/role`, {
      method: 'PUT',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ role }),
    });
    const json: ApiResponse<AdminUser> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '更新用户角色失败');
    }

    return json.data;
  }

  async resetUserPassword(id: number, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE}/users/${id}/reset-password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ newPassword }),
    });
    const json: ApiResponse<null> = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || '重置密码失败');
    }
  }

  async batchUpdateUserStatus(userIds: number[], isActive: boolean): Promise<AdminBatchOperationResult> {
    const response = await fetch(`${API_BASE}/users/batch/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ userIds, isActive }),
    });
    const json: ApiResponse<AdminBatchOperationResult> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '批量更新用户状态失败');
    }

    return json.data;
  }

  async batchUpdateUserRole(userIds: number[], role: 'Admin' | 'User'): Promise<AdminBatchOperationResult> {
    const response = await fetch(`${API_BASE}/users/batch/role`, {
      method: 'PUT',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ userIds, role }),
    });
    const json: ApiResponse<AdminBatchOperationResult> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '批量更新用户角色失败');
    }

    return json.data;
  }

  async getReflectionContent(): Promise<ReflectionContent> {
    const response = await fetch(`${API_BASE}/reflection`, {
      headers: this.getAuthHeaders(false),
    });
    const json: ApiResponse<ReflectionContent> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '加载吾日三省吾身原文失败');
    }

    return json.data;
  }

  async updateReflectionContent(content: string): Promise<ReflectionContent> {
    const response = await fetch(`${API_BASE}/reflection`, {
      method: 'PUT',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ content }),
    });
    const json: ApiResponse<ReflectionContent> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '保存吾日三省吾身原文失败');
    }

    return json.data;
  }

  async exportDatabase(): Promise<DatabaseExportResult> {
    const response = await fetch(`${API_BASE}/export/database`, {
      method: 'POST',
      headers: this.getAuthHeaders(false),
    });

    if (!response.ok) {
      let message = '导出数据库备份失败';
      try {
        const json: ApiResponse<null> = await response.json();
        message = json.message || message;
      } catch {
        // ignore response parse errors
      }

      throw new Error(message);
    }

    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const fileNameMatch = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
    const fileName = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || 'database-backup.dump');

    return {
      blob: await response.blob(),
      fileName,
      tempFilePath: response.headers.get('X-Temp-File-Path'),
    };
  }

  async restoreDatabase(file: File, confirmRestore: boolean): Promise<DatabaseRestoreResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confirmRestore', String(confirmRestore));

    const response = await fetch(`${API_BASE}/restore/database`, {
      method: 'POST',
      headers: this.getAuthHeaders(false),
      body: formData,
    });

    const json: ApiResponse<DatabaseRestoreResult> = await response.json();

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || '恢复数据库备份失败');
    }

    return json.data;
  }
}

export const adminService = new AdminService();
