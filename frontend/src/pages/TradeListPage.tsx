import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import type { TradeSortField } from '../stores/TradeListStore';
import StockLink from '../components/StockLink';
import { extractDatePart } from '../utils/date';
import './TradeListPage.css';

const TradeListPage = observer(() => {
  const { tradeListStore: store } = useStore();
  const [keyword, setKeyword] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [board, setBoard] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    store.fetch();
  }, [store]);

  const handleSearch = () => {
    store.setFilters({ keyword, tradeDate, board });
    store.fetch();
  };

  const handleReset = () => {
    setKeyword('');
    setTradeDate('');
    setBoard('');
    store.setFilters({ keyword: '', tradeDate: '', board: '' });
    store.fetch();
  };

  const handleDelete = async (id: number) => {
    await store.delete(id);
    setDeleteConfirmId(null);
  };

  const handleSort = (field: TradeSortField) => {
    store.toggleSort(field);
  };

  const sortIndicator = (field: TradeSortField) => {
    if (store.sortField !== field) return '';
    return store.sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);

  const getTradeStatus = (row: (typeof store.data)[number]) =>
    row.isLiquidated || row.positionQuantity <= 0 ? '清仓' : '持仓';

  const getTradeStatusClassName = (row: (typeof store.data)[number]) =>
    getTradeStatus(row) === '清仓' ? 'tlp-status-tag--liquidated' : 'tlp-status-tag--holding';

  const renderPagination = () => {
    if (store.totalPages <= 1) return null;
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
      <div className="tlp-pagination">
        <button disabled={store.page <= 1} onClick={() => store.setPage(store.page - 1)}>
          ‹ 上一页
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="tlp-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={p === store.page ? 'tlp-pagination__active' : ''}
              onClick={() => store.setPage(p as number)}
            >
              {p}
            </button>
          )
        )}
        <button disabled={store.page >= store.totalPages} onClick={() => store.setPage(store.page + 1)}>
          下一页 ›
        </button>
        <span className="tlp-pagination__info">
          共 {store.total} 条，第 {store.page}/{store.totalPages} 页
        </span>
      </div>
    );
  };

  return (
    <div className="tlp-container">
      <header className="tlp-header">
        <div>
          <h1 className="tlp-title">交易记录列表</h1>
          <p className="tlp-subtitle">心魔交易明细与盈亏统计</p>
        </div>
        <button className="tlp-refresh-btn" onClick={() => store.fetch()} disabled={store.loading}>
          刷新
        </button>
      </header>

      <div className="tlp-filter-bar">
        <label>心魔代码</label>
        <input
          type="text"
          placeholder="如 000001"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="tlp-input-text"
        />
        <label>交易日期</label>
        <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
        <label>板块</label>
        <input
          type="text"
          placeholder="如 创业板"
          value={board}
          onChange={(e) => setBoard(e.target.value)}
          className="tlp-input-text"
        />
        <button className="tlp-btn-primary" onClick={handleSearch} disabled={store.loading}>
          查询
        </button>
        <button className="tlp-btn-secondary" onClick={handleReset} disabled={store.loading}>
          重置
        </button>
      </div>

      <main className="tlp-main">
        {store.loading && (
          <div className="tlp-status">
            <div className="tlp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && (
          <div className="tlp-error">
            <span>{store.error}</span>
            <button onClick={() => { store.clearError(); store.fetch(); }}>重试</button>
          </div>
        )}

        {!store.loading && store.data.length === 0 && !store.error && (
          <div className="tlp-empty">
            <span>暂无数据</span>
          </div>
        )}

        {store.data.length > 0 && (
          <>
            <div className="tlp-table-wrap">
              <table className="tlp-table">
                <thead>
                  <tr>
                    <th className="tlp-sortable" onClick={() => handleSort('tradeDate')}>
                      日期{sortIndicator('tradeDate')}
                    </th>
                    <th className="tlp-sortable" onClick={() => handleSort('stockCode')}>
                      代码{sortIndicator('stockCode')}
                    </th>
                    <th>名称</th>
                    <th>板块</th>
                    <th>状态</th>
                    <th className="tlp-sortable" onClick={() => handleSort('buyPrice')}>
                      买入价{sortIndicator('buyPrice')}
                    </th>
                    <th className="tlp-num">买入量</th>
                    <th className="tlp-sortable" onClick={() => handleSort('sellPrice')}>
                      卖出价{sortIndicator('sellPrice')}
                    </th>
                    <th className="tlp-num">卖出量</th>
                    <th className="tlp-sortable" onClick={() => handleSort('positionPnL')}>
                      持仓盈亏{sortIndicator('positionPnL')}
                    </th>
                    <th>累计盈亏</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.displayedData.map((row) => (
                    <tr key={row.id}>
                      <td data-label="日期">{extractDatePart(row.tradeDate)}</td>
                      <td data-label="代码" className="tlp-mono">
                        <StockLink stockCode={row.stockCode} stockName={row.stockName} />
                      </td>
                      <td data-label="名称">{row.stockName}</td>
                      <td data-label="板块">{row.board}</td>
                      <td data-label="状态">
                        <span className={`tlp-status-tag ${getTradeStatusClassName(row)}`}>
                          {getTradeStatus(row)}
                        </span>
                      </td>
                      <td data-label="买入价" className="tlp-num">{row.buyPrice.toFixed(2)}</td>
                      <td data-label="买入量" className="tlp-num">{row.buyQuantity}</td>
                      <td data-label="卖出价" className="tlp-num">{row.sellPrice.toFixed(2)}</td>
                      <td data-label="卖出量" className="tlp-num">{row.sellQuantity}</td>
                      <td
                        data-label="持仓盈亏"
                        className={`tlp-num ${row.positionPnL >= 0 ? 'tlp-positive' : 'tlp-negative'}`}
                      >
                        {formatMoney(row.positionPnL)}
                      </td>
                      <td
                        data-label="累计盈亏"
                        className={`tlp-num ${row.cumulativePnL >= 0 ? 'tlp-positive' : 'tlp-negative'}`}
                      >
                        {formatMoney(row.cumulativePnL)}
                      </td>
                      <td data-label="备注" className="tlp-remark">{row.tradeNote || '-'}</td>
                      <td data-label="操作">
                        {deleteConfirmId === row.id ? (
                          <span className="tlp-actions-confirm">
                            <button
                              className="tlp-btn-danger-sm"
                              onClick={() => handleDelete(row.id)}
                            >
                              确认删除
                            </button>
                            <button
                              className="tlp-btn-secondary-sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            className="tlp-btn-danger-sm"
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

export default TradeListPage;
