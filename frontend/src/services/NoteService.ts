const API_BASE = '/api/note';

export interface NoteResponse {
  id: number;
  date: string;
  stockCode: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteRequest {
  date: string;
  stockCode?: string | null;
  content: string;
}

export interface NoteApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export class NoteService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /** 搜索笔记（关键字/日期/心魔代码） */
  async search(params: {
    keyword?: string;
    date?: string;
    stockCode?: string;
  }): Promise<NoteApiResponse<NoteResponse[]>> {
    const sp = new URLSearchParams();
    if (params.keyword) sp.append('keyword', params.keyword);
    if (params.date) sp.append('date', params.date);
    if (params.stockCode) sp.append('stockCode', params.stockCode);
    const url = `${API_BASE}${sp.toString() ? '?' + sp.toString() : ''}`;
    const response = await fetch(url, { headers: this.getAuthHeaders() });
    return response.json();
  }

  /** 获取全局笔记 */
  async getGlobal(): Promise<NoteApiResponse<NoteResponse[]>> {
    const response = await fetch(`${API_BASE}/global`, {
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }

  /** 获取指定心魔的笔记 */
  async getByStockCode(stockCode: string): Promise<NoteApiResponse<NoteResponse[]>> {
    const response = await fetch(`${API_BASE}/stock/${encodeURIComponent(stockCode)}`, {
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }

  /** 新增笔记 */
  async create(request: NoteRequest): Promise<NoteApiResponse<NoteResponse>> {
    const response = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }

  /** 修改笔记 */
  async update(id: number, request: NoteRequest): Promise<NoteApiResponse<NoteResponse>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return response.json();
  }

  /** 删除笔记 */
  async delete(id: number): Promise<NoteApiResponse<null>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }
}

export const noteService = new NoteService();
