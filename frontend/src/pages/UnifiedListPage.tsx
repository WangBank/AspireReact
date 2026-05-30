import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/StoreProvider';
import type { UnifiedItemType, UnifiedListItem, UnifiedSortField } from '../stores/UnifiedListStore';
import StockLink from '../components/StockLink';
import SortableHeader from '../components/Table/SortableHeader';
import TablePagination from '../components/Table/TablePagination';
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

  const resetSelectionState = () => {
    setSelectedKeys([]);
    setBatchDeleteConfirm(false);
    setDeleteConfirm(null);
  };

  const handleTypeChange = (val: 'account' | 'bankflow' | 'trade') => {
    resetSelectionState();
    store.setActiveType(val);
  };

  const handleSort = (field: UnifiedSortField) => {
    store.toggleSort(field);
  };

  const handleSearch = () => {
    resetSelectionState();
    store.setDateRange(startDate, endDate);
    store.setKeyword(keyword);
    store.fetch();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setKeyword('');
    resetSelectionState();
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
  const tradeGroups = isTrade
    ? store.displayedData.reduce<Array<{ date: string; items: UnifiedListItem[] }>>((groups, item) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.date === item.date) {
        lastGroup.items.push(item);
      } else {
        groups.push({ date: item.date, items: [item] });
      }
      return groups;
    }, [])
    : [];

  const renderTradeGroupSummary = (date: string) => {
    const summary = store.tradeDaySummaries[date];
    if (!summary) {
      return null;
    }

    return (
      <div className="ulp-group-summary">
        <span className="ulp-group-summary-item">
          总资产 {formatMoney(summary.totalAssets)}
        </span>
        <span className={`ulp-group-summary-item ${summary.dailyPnL >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>
          当日盈亏 {formatMoney(summary.dailyPnL)}
        </span>
      </div>
    );
  };

  const renderStandardTableHeader = () => (
    <tr>
      <th className="ulp-select-cell">
        <input
          type="checkbox"
          checked={allDisplayedSelected}
          onChange={handleToggleAllDisplayed}
          aria-label="全选当前页"
        />
      </th>
      <SortableHeader
        field={'date' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        日期
      </SortableHeader>
      {isAccount && (
        <>
          <SortableHeader
            field={'remark' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
          >
            备注
          </SortableHeader>
          <SortableHeader
            field={'totalAssets' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            总资产
          </SortableHeader>
          <SortableHeader
            field={'positionValue' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            持仓市值
          </SortableHeader>
          <SortableHeader
            field={'availableFunds' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            可用资金
          </SortableHeader>
          <SortableHeader
            field={'dailyPnL' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            当日盈亏
          </SortableHeader>
        </>
      )}
      {isBankFlow && (
        <>
          <SortableHeader
            field={'remark' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
          >
            备注
          </SortableHeader>
          <SortableHeader
            field={'flowType' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
          >
            流水类型
          </SortableHeader>
          <SortableHeader
            field={'amount' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            金额
          </SortableHeader>
        </>
      )}
      <th>操作</th>
    </tr>
  );

  const renderTradeTableHeader = () => (
    <tr>
      <th className="ulp-select-cell">
        <input
          type="checkbox"
          checked={allDisplayedSelected}
          onChange={handleToggleAllDisplayed}
          aria-label="全选当前页"
        />
      </th>
      <SortableHeader
        field={'stockCode' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        代码
      </SortableHeader>
      <SortableHeader
        field={'stockName' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        名称
      </SortableHeader>
      <SortableHeader
        field={'board' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        板块
      </SortableHeader>
      <SortableHeader
        field={'status' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        状态
      </SortableHeader>
      <SortableHeader
        field={'tradePositionValue' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
        className="ulp-num"
      >
        持仓盈亏
      </SortableHeader>
      <SortableHeader
        field={'positionQuantity' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
        className="ulp-num"
      >
        持仓数量
      </SortableHeader>
      <SortableHeader
        field={'dailyPnL' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
        className="ulp-num"
      >
        当日盈亏
      </SortableHeader>
      <th>操作</th>
    </tr>
  );

  const renderActionCell = (item: UnifiedListItem) => (
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
  );

  const renderStandardRow = (item: UnifiedListItem) => {
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

        {isAccountItem && (
          <>
            <td data-label="备注" className="ulp-remark">{item.remark || '-'}</td>
            <td data-label="总资产" className="ulp-num">{formatMoney(item.totalAssets ?? 0)}</td>
            <td data-label="持仓市值" className="ulp-num">{formatMoney(item.positionValue ?? 0)}</td>
            <td data-label="可用资金" className="ulp-num">{formatMoney(item.availableFunds ?? 0)}</td>
            <td data-label="当日盈亏" className={`ulp-num ${(item.dailyPnL ?? 0) >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>{formatMoney(item.dailyPnL ?? 0)}</td>
          </>
        )}

        {isBankFlowItem && (
          <>
            <td data-label="备注" className="ulp-remark">{item.remark || '-'}</td>
            <td data-label="类型">
              <span className={item.flowType === '转入' ? 'ulp-in' : 'ulp-out'}>
                {item.flowType}
              </span>
            </td>
            <td
              data-label="金额"
              className={`ulp-num ${item.flowType === '转入' ? 'ulp-in' : 'ulp-out'}`}
            >
              {formatMoney(item.amount ?? 0)}
            </td>
          </>
        )}

        <td data-label="操作">
          {renderActionCell(item)}
        </td>
      </tr>
    );
  };

  const renderTradeRow = (item: UnifiedListItem) => (
    <tr key={`${item.type}-${item.id}`}>
      <td className="ulp-select-cell" data-label="选择">
        <input
          type="checkbox"
          checked={selectedKeys.includes(getItemKey(item))}
          onChange={() => handleToggleItem(item)}
          aria-label={`选择 ${item.type}-${item.id}`}
        />
      </td>
      <td data-label="代码" className="ulp-mono">
        <StockLink stockCode={item.stockCode || ''} stockName={item.stockName || ''} />
      </td>
      <td data-label="名称">{item.stockName || '-'}</td>
      <td data-label="板块">{item.board || '-'}</td>
      <td data-label="状态">
        <span className={`ulp-status-tag ${getTradeStatusClassName(item)}`}>
          {getTradeStatus(item)}
        </span>
      </td>
      <td data-label="持仓盈亏" className={`ulp-num ${(item.tradePositionValue ?? 0) >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>
        {item.tradePositionValue != null ? formatMoney(item.tradePositionValue) : '-'}
      </td>
      <td data-label="持仓数量" className="ulp-num">{item.positionQuantity ?? '-'}</td>
      <td data-label="当日盈亏" className={`ulp-num ${(item.dailyPnL ?? 0) >= 0 ? 'ulp-positive' : 'ulp-negative'}`}>
        {item.dailyPnL != null ? formatMoney(item.dailyPnL) : '-'}
      </td>
      <td data-label="操作">
        {renderActionCell(item)}
      </td>
    </tr>
  );

  return (
    <div className="ulp-container">
      <header className="ulp-header">
        <div>
          <h1 className="ulp-title">数据列表</h1>
          <p className="ulp-subtitle">
            {TYPE_OPTIONS.find(t => t.value === store.activeType)?.label || '数据'}视图
          </p>
        </div>
      </header>

      {/* ── 类型选择器 ── */}
      <div className="ulp-filter-bar">
        <label>数据类型</label>
        <div className="ulp-type-switch" role="radiogroup" aria-label="数据类型">
          {TYPE_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`ulp-type-option ${store.activeType === opt.value ? 'ulp-type-option--active' : ''}`}
            >
              <input
                type="radio"
                name="unified-list-type"
                checked={store.activeType === opt.value}
                onChange={() => handleTypeChange(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

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
        <button className="ulp-btn-secondary" onClick={() => store.fetch()} disabled={store.loading}>
          刷新
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

        {store.data.length > 0 && !isTrade && (
          <>
            <div className="ulp-table-wrap">
              <table className={`ulp-table ${isAccount ? 'ulp-table--account' : 'ulp-table--bankflow'}`}>
                <thead>
                  {renderStandardTableHeader()}
                </thead>
                <tbody>
                  {store.displayedData.map(renderStandardRow)}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={store.page}
              totalPages={store.totalPages}
              totalItems={store.totalCount}
              onPageChange={store.setPage}
            />
          </>
        )}

        {store.data.length > 0 && isTrade && (
          <>
            <div className="ulp-trade-groups">
              {tradeGroups.map(group => (
                <section key={group.date} className="ulp-trade-group">
                  <div className="ulp-group-header">
                    <div className="ulp-group-header-main">
                      <div className="ulp-group-date">{group.date}</div>
                      {renderTradeGroupSummary(group.date)}
                    </div>
                    <div className="ulp-group-meta">{group.items.length} 条记录</div>
                  </div>
                  <div className="ulp-table-wrap">
                    <table className="ulp-table ulp-table--trade">
                      <thead>
                        {renderTradeTableHeader()}
                      </thead>
                      <tbody>
                        {group.items.map(renderTradeRow)}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
            <TablePagination
              page={store.page}
              totalPages={store.totalPages}
              totalItems={store.totalCount}
              onPageChange={store.setPage}
            />
          </>
        )}
      </main>
    </div>
  );
});

export default UnifiedListPage;
