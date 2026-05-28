import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/StoreProvider';
import StockLink from '../components/StockLink';
import './UnifiedListPage.css';

const TYPE_LABELS: Record<string, string> = {
  account: '账户',
  bankflow: '流水',
  trade: '交易',
};

const TYPE_COLORS: Record<string, string> = {
  account: '#1677ff',
  bankflow: '#13c2c2',
  trade: '#fa8c16',
};

const UnifiedListPage = observer(() => {
  const { unifiedListStore: store } = useStore();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number } | null>(null);

  useEffect(() => {
    store.fetch();
  }, [store]);

  const handleSearch = () => {
    store.setDateRange(startDate, endDate);
    store.setKeyword(keyword);
    store.fetch();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setKeyword('');
    store.setDateRange('', '');
    store.setKeyword('');
    store.fetch();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await store.delete(deleteConfirm.type as 'account' | 'bankflow' | 'trade', deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);

  const renderTypeBadge = (type: string) => (
    <span
      className="ulp-type-badge"
      style={{ backgroundColor: TYPE_COLORS[type] || '#999' }}
    >
      {TYPE_LABELS[type] || type}
    </span>
  );

  const renderAccountRow = (item: any) => (
    <>
      <td data-label="总资产" className="ulp-num">{formatMoney(item.totalAssets)}</td>
      <td data-label="当日盈亏" className={`ulp-num ${item.dailyPnL >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>{formatMoney(item.dailyPnL)}</td>
      <td data-label="持仓市值" className="ulp-num">{formatMoney(item.positionValue)}</td>
      <td data-label="可用资金" className="ulp-num">{formatMoney(item.availableFunds)}</td>
    </>
  );

  const renderBankFlowRow = (item: any) => (
    <>
      <td data-label="类型">
        <span className={item.flowType === '转入' ? 'ulp-in' : 'ulp-out'}>
          {item.flowType}
        </span>
      </td>
      <td data-label="金额" className="ulp-num">{formatMoney(item.amount)}</td>
      <td colSpan={4} />
    </>
  );

  const renderTradeRow = (item: any) => (
    <>
      <td data-label="代码" className="ulp-mono">
        <StockLink stockCode={item.stockCode} stockName={item.stockName} />
      </td>
      <td data-label="名称">{item.stockName}</td>
      <td data-label="板块">{item.board}</td>
      <td data-label="买入价" className="ulp-num">{item.buyPrice?.toFixed(2)}</td>
      <td data-label="买入量" className="ulp-num">{item.buyQuantity}</td>
      <td data-label="卖出价" className="ulp-num">{item.sellPrice?.toFixed(2)}</td>
      <td data-label="卖出量" className="ulp-num">{item.sellQuantity}</td>
      <td data-label="持仓盈亏" className={`ulp-num ${item.positionPnL >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>{formatMoney(item.positionPnL)}</td>
      <td data-label="累计盈亏" className={`ulp-num ${item.cumulativePnL >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>{formatMoney(item.cumulativePnL)}</td>
    </>
  );

  const renderPagination = () => {
    const tp = store.totalPages;
    if (tp <= 1) return null;
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
      <div className="ulp-pagination">
        <button disabled={store.page <= 1} onClick={() => store.setPage(store.page - 1)}>
          ‹ 上一页
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="ulp-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={p === store.page ? 'ulp-pagination__active' : ''}
              onClick={() => store.setPage(p as number)}
            >
              {p}
            </button>
          )
        )}
        <button disabled={store.page >= store.totalPages} onClick={() => store.setPage(store.page + 1)}>
          下一页 ›
        </button>
        <span className="ulp-pagination__info">
          共 {store.totalCount} 条，第 {store.page}/{store.totalPages} 页
        </span>
      </div>
    );
  };

  return (
    <div className="ulp-container">
      <header className="ulp-header">
        <div>
          <h1 className="ulp-title">数据列表</h1>
          <p className="ulp-subtitle">账户资金、银证流水、交易记录统一视图</p>
        </div>
        <button className="ulp-refresh-btn" onClick={() => store.fetch()} disabled={store.loading}>
          刷新
        </button>
      </header>

      <div className="ulp-filter-bar">
        <label>开始日期</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>结束日期</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <label>搜索</label>
        <input
          type="text"
          placeholder="代码/名称/备注"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="ulp-input-text"
        />
        <button className="ulp-btn-primary" onClick={handleSearch} disabled={store.loading}>
          查询
        </button>
        <button className="ulp-btn-secondary" onClick={handleReset} disabled={store.loading}>
          重置
        </button>
      </div>

      <main className="ulp-main">
        {store.loading && (
          <div className="ulp-status">
            <div className="ulp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && (
          <div className="ulp-error">
            <span>{store.error}</span>
            <button onClick={() => { store.clearError(); store.fetch(); }}>重试</button>
          </div>
        )}

        {!store.loading && store.data.length === 0 && !store.error && (
          <div className="ulp-empty">
            <span>暂无数据</span>
          </div>
        )}

        {store.data.length > 0 && (
          <>
            <div className="ulp-table-wrap">
              <table className="ulp-table">
                <thead>
                  <tr>
                    <th
                      className="ulp-sortable"
                      onClick={() => store.toggleSort('date')}
                    >
                      日期{store.sortField === 'date' ? (store.sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                    </th>
                    <th>类型</th>
                    <th>备注</th>
                    {/* 账户字段 */}
                    <th>总资产</th>
                    <th>当日盈亏</th>
                    <th>持仓市值</th>
                    <th>可用资金</th>
                    {/* 流水字段 */}
                    <th>流水类型</th>
                    <th>金额</th>
                    {/* 交易字段 */}
                    <th>代码</th>
                    <th>名称</th>
                    <th>板块</th>
                    <th>买入价</th>
                    <th>买入量</th>
                    <th>卖出价</th>
                    <th>卖出量</th>
                    <th>持仓盈亏</th>
                    <th>累计盈亏</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.displayedData.map((item) => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td data-label="日期">{item.date}</td>
                      <td data-label="类型">{renderTypeBadge(item.type)}</td>
                      <td data-label="备注" className="ulp-remark">{item.remark || '-'}</td>
                      {item.type === 'account' && renderAccountRow(item)}
                      {item.type === 'bankflow' && renderBankFlowRow(item)}
                      {item.type === 'trade' && renderTradeRow(item)}
                      <td data-label="操作">
                        <div className="ulp-actions">
                          {item.type === 'trade' && (
                            <button
                              className="ulp-btn-secondary-sm"
                              onClick={() => navigate(`/entry/unified/${item.id}`)}
                            >
                              编辑
                            </button>
                          )}
                          {deleteConfirm?.type === item.type && deleteConfirm?.id === item.id ? (
                            <span className="ulp-actions-confirm">
                              <button className="ulp-btn-danger-sm" onClick={handleDelete}>
                                确认删除
                              </button>
                              <button className="ulp-btn-secondary-sm" onClick={() => setDeleteConfirm(null)}>
                                取消
                              </button>
                            </span>
                          ) : (
                            <button
                              className="ulp-btn-danger-sm"
                              onClick={() => setDeleteConfirm({ type: item.type, id: item.id })}
                            >
                              删除
                            </button>
                          )}
                        </div>
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

export default UnifiedListPage;
