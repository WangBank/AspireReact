import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import './GlobalNotesPage.css';

const GlobalNotesPage = observer(() => {
  const { notesStore: store } = useStore();
  const [searchExpanded, setSearchExpanded] = useState(false);

  useEffect(() => {
    store.loadGlobalNotes();
  }, [store]);

  const handleSearch = () => {
    store.searchNotes();
  };

  const handleReset = () => {
    store.setKeyword('');
    store.setSearchDate('');
    store.setSearchStockCode('');
    store.loadGlobalNotes();
  };

  const handleDelete = async (id: number) => {
    store.askDelete(id);
  };

  const handleConfirmDelete = async () => {
    await store.confirmDelete();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const renderNoteItem = (note: any) => (
    <div key={note.id} className="gnp-note-card">
      <div className="gnp-note-header">
        <span className="gnp-note-date">{formatDate(note.date)}</span>
        {note.stockCode && <span className="gnp-note-stock">[{note.stockCode}]</span>}
        <div className="gnp-note-actions">
          <button
            className="gnp-btn-edit"
            onClick={() => store.openEdit(note)}
          >
            编辑
          </button>
          {store.deletingId === note.id ? (
            <>
              <button className="gnp-btn-danger" onClick={handleConfirmDelete}>
                确认删除
              </button>
              <button className="gnp-btn-secondary" onClick={() => store.cancelDelete()}>
                取消
              </button>
            </>
          ) : (
            <button className="gnp-btn-danger" onClick={() => handleDelete(note.id)}>
              删除
            </button>
          )}
        </div>
      </div>
      <div className="gnp-note-content">{note.content}</div>
    </div>
  );

  return (
    <div className="gnp-container">
      <header className="gnp-header">
        <div>
          <h1 className="gnp-title">全局复盘笔记</h1>
          <p className="gnp-subtitle">日常投资心得与策略复盘</p>
        </div>
        <div className="gnp-header-actions">
          <button
            className="gnp-btn-search-toggle"
            onClick={() => setSearchExpanded(!searchExpanded)}
          >
            {searchExpanded ? '收起搜索' : '搜索'}
          </button>
          <button className="gnp-btn-refresh" onClick={() => store.loadGlobalNotes()} disabled={store.loading}>
            刷新
          </button>
          <button className="gnp-btn-primary" onClick={() => store.openCreate()}>
            + 新建笔记
          </button>
        </div>
      </header>

      {searchExpanded && (
        <div className="gnp-search-bar">
          <label>关键词</label>
          <input
            type="text"
            placeholder="搜索笔记内容..."
            value={store.keyword}
            onChange={(e) => store.setKeyword(e.target.value)}
          />
          <label>日期</label>
          <input
            type="date"
            value={store.searchDate}
            onChange={(e) => store.setSearchDate(e.target.value)}
          />
          <label>股票代码</label>
          <input
            type="text"
            placeholder="如 000001"
            value={store.searchStockCode}
            onChange={(e) => store.setSearchStockCode(e.target.value)}
          />
          <button className="gnp-btn-primary" onClick={handleSearch} disabled={store.loading}>
            搜索
          </button>
          <button className="gnp-btn-secondary" onClick={handleReset} disabled={store.loading}>
            重置
          </button>
        </div>
      )}

      <main className="gnp-main">
        {store.loading && (
          <div className="gnp-status">
            <div className="gnp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && (
          <div className="gnp-error">
            <span>{store.error}</span>
            <button onClick={() => { store.clearError(); store.loadGlobalNotes(); }}>重试</button>
          </div>
        )}

        {!store.loading && store.notes.length === 0 && !store.error && (
          <div className="gnp-empty">
            <div className="gnp-empty-icon">&#9998;</div>
            <span>暂无笔记</span>
            <button className="gnp-btn-primary" onClick={() => store.openCreate()}>
              写第一篇笔记
            </button>
          </div>
        )}

        {store.notes.length > 0 && (
          <div className="gnp-note-list">
            {store.notes.map(renderNoteItem)}
          </div>
        )}

        {!store.loading && store.notes.length > 0 && (
          <div className="gnp-count">共 {store.notes.length} 条笔记</div>
        )}
      </main>

      {/* 编辑器模态框 */}
      {store.editorOpen && (
        <div className="gnp-modal-overlay" onClick={store.closeEditor}>
          <div className="gnp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gnp-modal-header">
              <h2>{store.editingNote ? '编辑笔记' : '新建笔记'}</h2>
              <button className="gnp-modal-close" onClick={store.closeEditor}>&times;</button>
            </div>
            <div className="gnp-modal-body">
              <div className="gnp-form-group">
                <label>日期 <span className="gnp-required">*</span></label>
                <input
                  type="date"
                  value={store.editDate}
                  onChange={(e) => { store.editDate = e.target.value; }}
                />
              </div>
              <div className="gnp-form-group">
                <label>关联股票</label>
                <input
                  type="text"
                  placeholder="可选，如 000001"
                  value={store.editStockCode}
                  onChange={(e) => { store.editStockCode = e.target.value; }}
                />
              </div>
              <div className="gnp-form-group">
                <label>内容 <span className="gnp-required">*</span></label>
                <textarea
                  rows={10}
                  placeholder="输入笔记内容..."
                  value={store.editContent}
                  onChange={(e) => { store.editContent = e.target.value; }}
                />
              </div>
            </div>
            <div className="gnp-modal-footer">
              <button className="gnp-btn-secondary" onClick={store.closeEditor}>
                取消
              </button>
              <button className="gnp-btn-primary" onClick={() => store.save()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GlobalNotesPage;
