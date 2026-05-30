import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/StoreProvider';
import type { UnifiedItemType, UnifiedListItem } from '../stores/UnifiedListStore';
import StockLink from '../components/StockLink';
import './UnifiedListPage.css';

const TYPE_OPTIONS: { value: 'account' | 'bankflow' | 'trade'; label: string }[] = [
  { value: 'account', label: '账户列表' },
  { value: 'bankflow', label: '流水列表' },
  { value: 'trade', label: '交易列表' },
];

const getItemKey = (item: Pick<UnifiedListItem, 'type' | 'id'>) => `${item.type}-${item.id}`;

const UnifiedListPage = observer(() => {
  const { unifiedListStore: store } = useStore();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number } | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // 初始加载：默认加载账户列表
  useEffect(() => {
    store.setActiveType('account');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const validKeys = new Set(store.data.map(getItemKey));
    setSelectedKeys(prev => prev.filter(key => validKeys.has(key)));
  }, [store.data]);

  const displayedKeys = store.displayedData.map(getItemKey);
  const selectedItems = store.data.filter(item => selectedKeys.includes(getItemKey(item)));

  const allDisplayedSelected = displayedKeys.length > 0
    && displayedKeys.every(key => selectedKeys.includes(key));

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as 'account' | 'bankflow' | 'trade';
    setSelectedKeys([]);
    setBatchDeleteConfirm(false);
    setDeleteConfirm(null);
    store.setActiveType(val);
  };

  const handleSearch = () => {
    setSelectedKeys([]);
    setBatchDeleteConfirm(false);
    setDeleteConfirm(null);
    store.setDateRange(startDate, endDate);
    store.setKeyword(keyword);
    store.fetch();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setKeyword('');
    setSelectedKeys([]);
    setBatchDeleteConfirm(false);
    setDeleteConfirm(null);
    store.setDateRange('', '');
    store.setKeyword('');
    store.fetch();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await store.delete(deleteConfirm.type as UnifiedItemType, deleteConfirm.id);
    setSelectedKeys(prev => prev.filter(key => key !== `${deleteConfirm.type}-${deleteConfirm.id}`));
    setDeleteConfirm(null);
  };

  const handleToggleItem = (item: UnifiedListItem) => {
    const key = getItemKey(item);
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(existing => existing !== key) : [...prev, key]
    );
  };

  const handleToggleAllDisplayed = () => {
    if (allDisplayedSelected) {
      setSelectedKeys(prev => prev.filter(key => !displayedKeys.includes(key)));
      return;
    }

    setSelectedKeys(prev => Array.from(new Set([...prev, ...displayedKeys])));
  };

  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {
      setBatchDeleteConfirm(false);
      return;
    }

    await store.deleteMany(selectedItems.map(item => ({ type: item.type, id: item.id })));
    setSelectedKeys([]);
    setBatchDeleteConfirm(false);
    setDeleteConfirm(null);
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);

  const getTradeStatus = (item: UnifiedListItem) => {
    if (item.isLiquidated || (item.positionQuantity ?? 0) <= 0) return '清仓';
    return '持仓';
  };

  const getTradeStatusClassName = (item: UnifiedListItem) =>
    getTradeStatus(item) === '清仓' ? 'ulp-status-tag--liquidated' : 'ulp-status-tag--holding';

  const isTrade = store.activeType === 'trade';
  const isAccount = store.activeType === 'account';
  const isBankFlow = store.activeType === 'bankflow';

  const renderTableHeader = () => (
    <tr>
      <th className="ulp-select-cell">
        <input
          type="checkbox"
          checked={allDisplayedSelected}
          onChange={handleToggleAllDisplayed}
          aria-label="全选当前页"
        />
      </th>
      <th
        className="ulp-sortable"
        onClick={() => store.toggleSort('date')}
      >
        日期{store.sortField === 'date' ? (store.sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
      </th>
      {!isTrade && <th>备注</th>}
      {isAccount && (
        <>
          <th className="ulp-num">总资产</th>
          <th className="ulp-num">持仓市值</th>
          <th className="ulp-num">可用资金</th>
          <th className="ulp-num">当日盈亏</th>
        </>
      )}
      {isBankFlow && (
        <>
          <th>流水类型</th>
          <th className="ulp-num">金额</th>
        </>
      )}
      {isTrade && (
        <>
          <th>代码</th>
          <th>名称</th>
          <th>板块</th>
          <th>状态</th>
          <th className="ulp-num">持仓盈亏</th>
          <th className="ulp-num">持仓数量</th>
          <th className="ulp-num">当日盈亏</th>
        </>
      )}
      <th>操作</th>
    </tr>
  );

  const renderRow = (item: any) => {
    const isTradeItem = item.type === 'trade';
    const isAccountItem = item.type === 'account';
    const isBankFlowItem = item.type === 'bankflow';

    return (
      <tr key={`${item.type}-${item.id}`}>
        <td className="ulp-select-cell" data-label="选择">
          <input
            type="checkbox"
            checked={selectedKeys.includes(getItemKey(item))}
            onChange={() => handleToggleItem(item)}
            aria-label={`选择 ${item.type}-${item.id}`}
          />
        </td>
        <td data-label="日期">{item.date}</td>
        {!isTradeItem && (
          <td data-label="备注" className="ulp-remark">{item.remark || '-'}</td>
        )}

        {isAccountItem && (
          <>
            <td data-label="总资产" className="ulp-num">{formatMoney(item.totalAssets)}</td>
            <td data-label="持仓市值" className="ulp-num">{formatMoney(item.positionValue)}</td>
            <td data-label="可用资金" className="ulp-num">{formatMoney(item.availableFunds)}</td>
            <td data-label="当日盈亏" className={`ulp-num ${item.dailyPnL >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>{formatMoney(item.dailyPnL)}</td>
          </>
        )}

        {isBankFlowItem && (
          <>
            <td data-label="类型">
              <span className={item.flowType === '转入' ? 'ulp-in' : 'ulp-out'}>
                {item.flowType}
              </span>
            </td>
            <td data-label="金额" className="ulp-num">{formatMoney(item.amount)}</td>
          </>
        )}

        {isTradeItem && (
          <>
            <td data-label="代码" className="ulp-mono">
              <StockLink stockCode={item.stockCode} stockName={item.stockName} />
            </td>
            <td data-label="名称">{item.stockName}</td>
            <td data-label="板块">{item.board}</td>
            <td data-label="状态">
              <span className={`ulp-status-tag ${getTradeStatusClassName(item)}`}>
                {getTradeStatus(item)}
              </span>
            </td>
            <td data-label="持仓盈亏" className={`ulp-num ${item.tradePositionValue >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>{item.tradePositionValue != null ? formatMoney(item.tradePositionValue) : '-'}</td>
            <td data-label="持仓数量" className="ulp-num">{item.positionQuantity ?? '-'}</td>
            <td data-label="当日盈亏" className={`ulp-num ${item.dailyPnL >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>{item.dailyPnL != null ? formatMoney(item.dailyPnL) : '-'}</td>
          </>
        )}

        <td data-label="操作">
          <div className="ulp-actions">
            <button
              className="ulp-btn-secondary-sm"
              onClick={() => navigate(`/entry/unified?type=${item.type}&id=${item.id}`)}
            >
              编辑
            </button>
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
    );
  };

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
          <p className="ulp-subtitle">
            {TYPE_OPTIONS.find(t => t.value === store.activeType)?.label || '数据'}视图
          </p>
        </div>
        <button className="ulp-refresh-btn" onClick={() => store.fetch()} disabled={store.loading}>
          刷新
        </button>
      </header>

      {/* ── 类型选择器 ── */}
      <div className="ulp-filter-bar">
        <label>数据类型</label>
        <select
          className="ulp-select"
          value={store.activeType}
          onChange={handleTypeChange}
        >
          {TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <label>开始日期</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>结束日期</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        {(isAccount || isBankFlow) && (
          <>
            <label>搜索</label>
            <input
              type="text"
              placeholder="备注关键词"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="ulp-input-text"
            />
          </>
        )}
        {isTrade && (
          <>
            <label>搜索</label>
            <input
              type="text"
              placeholder="代码/名称/板块"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="ulp-input-text"
            />
          </>
        )}

        <button className="ulp-btn-primary" onClick={handleSearch} disabled={store.loading}>
          查询
        </button>
        <button className="ulp-btn-secondary" onClick={handleReset} disabled={store.loading}>
          重置
        </button>
      </div>

      <main className="ulp-main">
        {selectedKeys.length > 0 && (
          <div className="ulp-batch-bar">
            <span>已选择 {selectedKeys.length} 条</span>
            {batchDeleteConfirm ? (
              <div className="ulp-batch-actions">
                <button className="ulp-btn-danger-sm" onClick={handleBatchDelete} disabled={store.loading}>
                  确认删除
                </button>
                <button className="ulp-btn-secondary-sm" onClick={() => setBatchDeleteConfirm(false)} disabled={store.loading}>
                  取消
                </button>
              </div>
            ) : (
              <div className="ulp-batch-actions">
                <button className="ulp-btn-danger-sm" onClick={() => setBatchDeleteConfirm(true)}>
                  批量删除
                </button>
                <button className="ulp-btn-secondary-sm" onClick={() => setSelectedKeys([])}>
                  清空选择
                </button>
              </div>
            )}
          </div>
        )}

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
                  {renderTableHeader()}
                </thead>
                <tbody>
                  {store.displayedData.map(renderRow)}
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
