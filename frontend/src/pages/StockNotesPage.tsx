import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import './StockNotesPage.css';

const StockNotesPage = observer(() => {
  const { notesStore: store } = useStore();
  const [stockCode, setStockCode] = useState('');
  const [inputStockCode, setInputStockCode] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);

  useEffect(() => {
    // 不自动加载，等用户输入股票代码
  }, [store]);

  const handleLoad = () => {
    const code = inputStockCode.trim();
    if (!code) {
      store.error = '请输入股票代码';
      return;
    }
    setStockCode(code);
    store.loadStockNotes(code);
  };

  const handleSearch = () => {
    store.searchNotes();
  };

  const handleReset = () => {
    store.setKeyword('');
    store.setSearchDate('');
    store.setSearchStockCode('');
    // 重新加载当前股票笔记
    if (stockCode) {
      store.loadStockNotes(stockCode);
    }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLoad();
  };

  const renderNoteItem = (note: any) => (
    <div key={note.id} className="snp-note-card">
      <div className="snp-note-header">
        <span className="snp-note-date">{formatDate(note.date)}</span>
        <div className="snp-note-actions">
          <button
            className="snp-btn-edit"
            onClick={() => store.openEdit(note)}
          >
            编辑
          </button>
          {store.deletingId === note.id ? (
            <>
              <button className="snp-btn-danger" onClick={handleConfirmDelete}>
                确认删除
              </button>
              <button className="snp-btn-secondary" onClick={() => store.cancelDelete()}>
                取消
              </button>
            </>
          ) : (
            <button className="snp-btn-danger" onClick={() => handleDelete(note.id)}>
              删除
            </button>
          )}
        </div>
      </div>
      <div className="snp-note-content">{note.content}</div>
    </div>
  );

  return (
    <div className="snp-container">
      <header className="snp-header">
        <div>
          <h1 className="snp-title">个股笔记管理</h1>
          <p className="snp-subtitle">
            {stockCode ? `查看 ${stockCode} 的交易笔记` : '输入股票代码查看对应笔记'}
          </p>
        </div>
        <div className="snp-header-actions">
          <button
            className="snp-btn-search-toggle"
            onClick={() => setSearchExpanded(!searchExpanded)}
          >
            {searchExpanded ? '收起搜索' : '搜索'}
          </button>
          {stockCode && (
            <>
              <button className="snp-btn-refresh" onClick={() => store.loadStockNotes(stockCode)} disabled={store.loading}>
                刷新
              </button>
              <button
                className="snp-btn-primary"
                onClick={() => store.openCreate(new Date().toISOString().slice(0, 10), stockCode)}
              >
                + 新建笔记
              </button>
            </>
          )}
        </div>
      </header>

      <div className="snp-stock-input-bar">
        <label>股票代码</label>
        <input
          type="text"
          placeholder="输入股票代码，如 000001"
          value={inputStockCode}
          onChange={(e) => setInputStockCode(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="snp-btn-primary" onClick={handleLoad} disabled={store.loading}>
          加载笔记
        </button>
      </div>

      {searchExpanded && (
        <div className="snp-search-bar">
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
          <button className="snp-btn-primary" onClick={handleSearch} disabled={store.loading}>
            搜索
          </button>
          <button className="snp-btn-secondary" onClick={handleReset} disabled={store.loading}>
            重置
          </button>
        </div>
      )}

      <main className="snp-main">
        {store.loading && (
          <div className="snp-status">
            <div className="snp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && (
          <div className="snp-error">
            <span>{store.error}</span>
            {stockCode && (
              <button onClick={() => { store.clearError(); store.loadStockNotes(stockCode); }}>重试</button>
            )}
          </div>
        )}

        {!stockCode && !store.loading && (
          <div className="snp-empty">
            <div className="snp-empty-icon">&#128270;</div>
            <span>请输入股票代码查看笔记</span>
          </div>
        )}

        {stockCode && !store.loading && store.notes.length === 0 && !store.error && (
          <div className="snp-empty">
            <div className="snp-empty-icon">&#9998;</div>
            <span>暂无笔记</span>
            <button
              className="snp-btn-primary"
              onClick={() => store.openCreate(new Date().toISOString().slice(0, 10), stockCode)}
            >
              为 {stockCode} 写第一篇笔记
            </button>
          </div>
        )}

        {store.notes.length > 0 && (
          <div className="snp-note-list">
            {store.notes.map(renderNoteItem)}
          </div>
        )}

        {!store.loading && store.notes.length > 0 && (
          <div className="snp-count">共 {store.notes.length} 条笔记</div>
        )}
      </main>

      {/* 编辑器模态框 */}
      {store.editorOpen && (
        <div className="snp-modal-overlay" onClick={store.closeEditor}>
          <div className="snp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="snp-modal-header">
              <h2>{store.editingNote ? '编辑笔记' : '新建笔记'}</h2>
              <button className="snp-modal-close" onClick={store.closeEditor}>&times;</button>
            </div>
            <div className="snp-modal-body">
              <div className="snp-form-group">
                <label>日期 <span className="snp-required">*</span></label>
                <input
                  type="date"
                  value={store.editDate}
                  onChange={(e) => { store.editDate = e.target.value; }}
                />
              </div>
              <div className="snp-form-group">
                <label>关联股票</label>
                <input
                  type="text"
                  placeholder="可选，如 000001"
                  value={store.editStockCode}
                  onChange={(e) => { store.editStockCode = e.target.value; }}
                />
              </div>
              <div className="snp-form-group">
                <label>内容 <span className="snp-required">*</span></label>
                <textarea
                  rows={10}
                  placeholder="输入笔记内容..."
                  value={store.editContent}
                  onChange={(e) => { store.editContent = e.target.value; }}
                />
              </div>
            </div>
            <div className="snp-modal-footer">
              <button className="snp-btn-secondary" onClick={store.closeEditor}>
                取消
              </button>
              <button className="snp-btn-primary" onClick={() => store.save()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default StockNotesPage;
