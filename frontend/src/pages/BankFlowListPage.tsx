import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import './BankFlowListPage.css';

const BankFlowListPage = observer(() => {
  const { bankFlowListStore: store } = useStore();
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

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);

  const renderPagination = () => {
    const tp = store.totalPages;
    const pages: (number | string)[] = [];
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i);
    } else {
      pages.push(1);
      if (store.page > 3) pages.push('...');
      const s = Math.max(2, store.page - 1);
      const e = Math.min(tp - 1, store.page + 1);
      for (let i = s; i <= e; i++) pages.push(i);
      if (store.page < tp - 2) pages.push('...');
      pages.push(tp);
    }
    return (
      <div className="bflp-pagination">
        <button disabled={store.page <= 1} onClick={() => store.setPage(store.page - 1)}>
          ‹ 上一页
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="bflp-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={p === store.page ? 'bflp-pagination__active' : ''}
              onClick={() => store.setPage(p as number)}
            >
              {p}
            </button>
          )
        )}
        <button disabled={store.page >= store.totalPages} onClick={() => store.setPage(store.page + 1)}>
          下一页 ›
        </button>
        <span className="bflp-pagination__info">
          共 {store.data.length} 条，第 {store.page}/{store.totalPages} 页
        </span>
      </div>
    );
  };

  return (
    <div className="bflp-container">
      <header className="bflp-header">
        <div>
          <h1 className="bflp-title">银证流水列表</h1>
          <p className="bflp-subtitle">银证转账流水明细</p>
        </div>
        <button className="bflp-refresh-btn" onClick={() => store.fetch()} disabled={store.loading}>
          刷新
        </button>
      </header>

      <div className="bflp-filter-bar">
        <label>开始日期</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>结束日期</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button className="bflp-btn-primary" onClick={handleSearch} disabled={store.loading}>
          查询
        </button>
        <button className="bflp-btn-secondary" onClick={handleReset} disabled={store.loading}>
          重置
        </button>
      </div>

      <main className="bflp-main">
        {store.loading && (
          <div className="bflp-status">
            <div className="bflp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && (
          <div className="bflp-error">
            <span>{store.error}</span>
            <button onClick={() => { store.clearError(); store.fetch(); }}>重试</button>
          </div>
        )}

        {!store.loading && store.data.length === 0 && !store.error && (
          <div className="bflp-empty">
            <span>暂无数据</span>
          </div>
        )}

        {store.data.length > 0 && (
          <>
            <div className="bflp-table-wrap">
              <table className="bflp-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>类型</th>
                    <th className="bflp-num">金额</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.pagedData.map((row) => (
                    <tr key={row.id}>
                      <td data-label="日期">{new Date(row.date).toISOString().split('T')[0]}</td>
                      <td data-label="类型">
                        <span className={row.flowType === '转入' ? 'bflp-in' : 'bflp-out'}>
                          {row.flowType}
                        </span>
                      </td>
                      <td data-label="金额" className="bflp-num">{formatMoney(row.amount)}</td>
                      <td data-label="备注">{row.remark || '-'}</td>
                      <td data-label="操作">
                        {deleteConfirmId === row.id ? (
                          <span className="bflp-actions-confirm">
                            <button
                              className="bflp-btn-danger-sm"
                              onClick={() => handleDelete(row.id)}
                            >
                              确认删除
                            </button>
                            <button
                              className="bflp-btn-secondary-sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            className="bflp-btn-danger-sm"
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

export default BankFlowListPage;
