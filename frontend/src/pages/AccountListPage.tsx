import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import type { SortField } from '../stores/AccountListStore';
import './AccountListPage.css';

const AccountListPage = observer(() => {
  const { accountListStore: store } = useStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    store.fetch();
  }, [store]);

  const handleSearch = () => {
    store.setDateRange(startDate, endDate);
    store.fetch();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    store.setDateRange('', '');
    store.fetch();
  };

  const handleDelete = async (id: number) => {
    await store.delete(id);
    setDeleteConfirmId(null);
  };

  const handleSort = (field: SortField) => {
    store.toggleSort(field);
  };

  const sortIndicator = (field: SortField) => {
    if (store.sortField !== field) return ' ↕';
    return store.sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);

  const renderPagination = () => {
    const pages: number[] = [];
    const tp = store.totalPages;
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i);
    } else {
      pages.push(1);
      if (store.page > 3) pages.push(-1);
      const start = Math.max(2, store.page - 1);
      const end = Math.min(tp - 1, store.page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (store.page < tp - 2) pages.push(-2);
      pages.push(tp);
    }
    return (
      <div className="alp-pagination">
        <button disabled={store.page <= 1} onClick={() => store.setPage(store.page - 1)}>
          ‹ 上一页
        </button>
        {pages.map((p, i) =>
          p < 0 ? (
            <span key={`e-${i}`} className="alp-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={p === store.page ? 'alp-pagination__active' : ''}
              onClick={() => store.setPage(p)}
            >
              {p}
            </button>
          )
        )}
        <button disabled={store.page >= store.totalPages} onClick={() => store.setPage(store.page + 1)}>
          下一页 ›
        </button>
        <span className="alp-pagination__info">
          共 {store.data.length} 条，第 {store.page}/{store.totalPages} 页
        </span>
      </div>
    );
  };

  return (
    <div className="alp-container">
      <header className="alp-header">
        <div>
          <h1 className="alp-title">账户资金列表</h1>
          <p className="alp-subtitle">每日账户资产与盈亏明细</p>
        </div>
        <button className="alp-refresh-btn" onClick={() => store.fetch()} disabled={store.loading}>
          刷新
        </button>
      </header>

      <div className="alp-filter-bar">
        <label>开始日期</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>结束日期</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button className="alp-btn-primary" onClick={handleSearch} disabled={store.loading}>
          查询
        </button>
        <button className="alp-btn-secondary" onClick={handleReset} disabled={store.loading}>
          重置
        </button>
      </div>

      <main className="alp-main">
        {store.loading && (
          <div className="alp-status">
            <div className="alp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && (
          <div className="alp-error">
            <span>{store.error}</span>
            <button onClick={() => { store.clearError(); store.fetch(); }}>重试</button>
          </div>
        )}

        {!store.loading && store.data.length === 0 && !store.error && (
          <div className="alp-empty">
            <span>暂无数据</span>
          </div>
        )}

        {store.data.length > 0 && (
          <>
            <div className="alp-table-wrap">
              <table className="alp-table">
                <thead>
                  <tr>
                    <th className="alp-sortable" onClick={() => handleSort('date')}>
                      日期{sortIndicator('date')}
                    </th>
                    <th className="alp-sortable" onClick={() => handleSort('totalAssets')}>
                      总资产{sortIndicator('totalAssets')}
                    </th>
                    <th className="alp-sortable" onClick={() => handleSort('dailyPnL')}>
                      当日盈亏{sortIndicator('dailyPnL')}
                    </th>
                    <th className="alp-num">持仓市值</th>
                    <th className="alp-num">可用资金</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.pagedData.map((row) => (
                    <tr key={row.id}>
                      <td data-label="日期">{new Date(row.date).toISOString().split('T')[0]}</td>
                      <td data-label="总资产" className="alp-num">{formatMoney(row.totalAssets)}</td>
                      <td
                        data-label="当日盈亏"
                        className={`alp-num ${row.dailyPnL >= 0 ? 'alp-positive' : 'alp-negative'}`}
                      >
                        {formatMoney(row.dailyPnL)}
                      </td>
                      <td data-label="持仓市值" className="alp-num">{formatMoney(row.positionValue)}</td>
                      <td data-label="可用资金" className="alp-num">{formatMoney(row.availableFunds)}</td>
                      <td data-label="备注">{row.remark || '-'}</td>
                      <td data-label="操作">
                        {deleteConfirmId === row.id ? (
                          <span className="alp-actions-confirm">
                            <button
                              className="alp-btn-danger-sm"
                              onClick={() => handleDelete(row.id)}
                            >
                              确认删除
                            </button>
                            <button
                              className="alp-btn-secondary-sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            className="alp-btn-danger-sm"
                            onClick={() => setDeleteConfirmId(row.id)}
                          >
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        )}
      </main>
    </div>
  );
});

export default AccountListPage;