import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import type { SortField } from '../stores/AccountListStore';
import SortableHeader from '../components/Table/SortableHeader';
import TablePagination from '../components/Table/TablePagination';
import { extractDatePart } from '../utils/date';
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

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);

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
                    <SortableHeader field={'date' as SortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort}>
                      日期
                    </SortableHeader>
                    <SortableHeader field={'totalAssets' as SortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort} className="alp-num">
                      总资产
                    </SortableHeader>
                    <SortableHeader field={'dailyPnL' as SortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort} className="alp-num">
                      当日盈亏
                    </SortableHeader>
                    <SortableHeader field={'positionValue' as SortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort} className="alp-num">
                      持仓市值
                    </SortableHeader>
                    <SortableHeader field={'availableFunds' as SortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort} className="alp-num">
                      可用资金
                    </SortableHeader>
                    <SortableHeader field={'remark' as SortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort}>
                      备注
                    </SortableHeader>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.pagedData.map((row) => (
                    <tr key={row.id}>
                      <td data-label="日期">{extractDatePart(row.date)}</td>
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
            <TablePagination
              page={store.page}
              totalPages={store.totalPages}
              totalItems={store.data.length}
              onPageChange={store.setPage}
            />
          </>
        )}
      </main>
    </div>
  );
});

export default AccountListPage;
