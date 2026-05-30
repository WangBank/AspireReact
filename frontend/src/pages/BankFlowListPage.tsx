import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import type { BankFlowSortField } from '../stores/BankFlowListStore';
import SortableHeader from '../components/Table/SortableHeader';
import TablePagination from '../components/Table/TablePagination';
import { extractDatePart } from '../utils/date';
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

  const handleSort = (field: BankFlowSortField) => {
    store.toggleSort(field);
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
                    <SortableHeader field={'date' as BankFlowSortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort}>
                      日期
                    </SortableHeader>
                    <SortableHeader field={'flowType' as BankFlowSortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort}>
                      类型
                    </SortableHeader>
                    <SortableHeader field={'amount' as BankFlowSortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort} className="bflp-num">
                      金额
                    </SortableHeader>
                    <SortableHeader field={'remark' as BankFlowSortField} currentField={store.sortField} currentOrder={store.sortOrder} onSort={handleSort}>
                      备注
                    </SortableHeader>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.pagedData.map((row) => (
                    <tr key={row.id}>
                      <td data-label="日期">{extractDatePart(row.date)}</td>
                      <td data-label="类型">
                        <span className={row.flowType === '转入' ? 'bflp-in' : 'bflp-out'}>
                          {row.flowType}
                        </span>
                      </td>
                      <td
                        data-label="金额"
                        className={`bflp-num ${row.flowType === '转入' ? 'bflp-in' : 'bflp-out'}`}
                      >
                        {formatMoney(row.amount)}
                      </td>
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

export default BankFlowListPage;
