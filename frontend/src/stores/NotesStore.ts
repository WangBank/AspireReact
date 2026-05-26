import { makeAutoObservable, runInAction } from 'mobx';
import { noteService } from '../services/NoteService';
import type { NoteResponse, NoteRequest } from '../services/NoteService';

export class NotesStore {
  notes: NoteResponse[] = [];
  loading = false;
  error: string | null = null;

  // 搜索条件
  keyword = '';
  searchDate = '';
  searchStockCode = '';

  // 编辑器对话框状态
  editorOpen = false;
  editingNote: NoteResponse | null = null;

  // 编辑器表单
  editDate = '';
  editStockCode = '';
  editContent = '';

  // 删除确认
  deletingId: number | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  // ===== 数据加载 =====

  /** 加载全局笔记 */
  loadGlobalNotes = async () => {
    this.loading = true;
    this.error = null;
    try {
      const res = await noteService.getGlobal();
      runInAction(() => {
        if (res.success) {
          this.notes = (res.data || []).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        } else {
          this.error = res.message || '查询失败';
          this.notes = [];
        }
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
        this.loading = false;
        this.notes = [];
      });
    }
  };

  /** 加载个股笔记 */
  loadStockNotes = async (stockCode: string) => {
    this.loading = true;
    this.error = null;
    try {
      const res = await noteService.getByStockCode(stockCode);
      runInAction(() => {
        if (res.success) {
          this.notes = (res.data || []).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        } else {
          this.error = res.message || '查询失败';
          this.notes = [];
        }
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
        this.loading = false;
        this.notes = [];
      });
    }
  };

  /** 按条件搜索 */
  searchNotes = async () => {
    this.loading = true;
    this.error = null;
    try {
      const res = await noteService.search({
        keyword: this.keyword || undefined,
        date: this.searchDate || undefined,
        stockCode: this.searchStockCode || undefined,
      });
      runInAction(() => {
        if (res.success) {
          this.notes = (res.data || []).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        } else {
          this.error = res.message || '查询失败';
          this.notes = [];
        }
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
        this.loading = false;
        this.notes = [];
      });
    }
  };

  // ===== 编辑器 =====

  /** 打开新建编辑器 */
  openCreate = (defaultDate?: string, defaultStockCode?: string) => {
    this.editingNote = null;
    this.editDate = defaultDate || new Date().toISOString().slice(0, 10);
    this.editStockCode = defaultStockCode || '';
    this.editContent = '';
    this.editorOpen = true;
  };

  /** 打开编辑编辑器 */
  openEdit = (note: NoteResponse) => {
    this.editingNote = note;
    this.editDate = note.date ? note.date.slice(0, 10) : '';
    this.editStockCode = note.stockCode || '';
    this.editContent = note.content;
    this.editorOpen = true;
  };

  /** 关闭编辑器 */
  closeEditor = () => {
    this.editorOpen = false;
    this.editingNote = null;
    this.editDate = '';
    this.editStockCode = '';
    this.editContent = '';
  };

  /** 保存（新建或更新） */
  save = async (): Promise<boolean> => {
    const date = this.editDate;
    const stockCode = this.editStockCode.trim() || null;
    const content = this.editContent.trim();
    if (!date || !content) {
      this.error = '日期和内容不能为空';
      return false;
    }

    const request: NoteRequest = { date, stockCode, content };

    try {
      if (this.editingNote) {
        const res = await noteService.update(this.editingNote.id, request);
        return runInAction(() => {
          if (res.success && res.data) {
            const idx = this.notes.findIndex((n) => n.id === res.data!.id);
            if (idx >= 0) this.notes[idx] = res.data;
            else this.notes.unshift(res.data);
            this.notes = [...this.notes].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            this.closeEditor();
            return true;
          }
          this.error = res.message || '更新失败';
          return false;
        });
      } else {
        const res = await noteService.create(request);
        return runInAction(() => {
          if (res.success && res.data) {
            this.notes.unshift(res.data);
            this.notes = [...this.notes].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            this.closeEditor();
            return true;
          }
          this.error = res.message || '创建失败';
          return false;
        });
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '网络错误';
      });
      return false;
    }
  };

  // ===== 删除 =====

  /** 标记待删除 */
  askDelete = (id: number) => {
    this.deletingId = id;
  };

  /** 取消删除确认 */
  cancelDelete = () => {
    this.deletingId = null;
  };

  /** 确认删除 */
  confirmDelete = async (): Promise<boolean> => {
    if (this.deletingId === null) return false;
    const id = this.deletingId;
    this.deletingId = null;
    try {
      const res = await noteService.delete(id);
      return runInAction(() => {
        if (res.success) {
          this.notes = this.notes.filter((n) => n.id !== id);
          return true;
        }
        this.error = res.message || '删除失败';
        return false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : '删除失败';
      });
      return false;
    }
  };

  // ===== 搜索条件 =====

  setKeyword = (keyword: string) => {
    this.keyword = keyword;
  };

  setSearchDate = (date: string) => {
    this.searchDate = date;
  };

  setSearchStockCode = (stockCode: string) => {
    this.searchStockCode = stockCode;
  };

  clearError = () => {
    this.error = null;
  };
}

export const notesStore = new NotesStore();
