import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import StockLink from '../components/StockLink';
import './StatisticsPage.css';

const BOARDS = ['主板', '创业板', '科创板', '北交所'] as const;
const DATE_FILTERS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'custom', label: '自定义' },
] as const;
const PNL_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'profit', label: '盈利' },
  { key: 'loss', label: '亏损' },
] as const;

const StatisticsPage = observer(() => {
  const { statisticsStore: store } = useStore();
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    store.setDateFilterType('month');
  }, [store]);

  const handleDateFilterClick = (type: string) => {
    if (type === 'custom') {
      store.setDateFilterType('custom');
    } else {
      store.setDateFilterType(type as 'today' | 'week' | 'month');
    }
  };

  const handleCustomSearch = () => {
    store.setCustomDateRange(customStart, customEnd);
    store.fetch();
  };

  const handlePnlFilterClick = (filter: string) => {
    store.setPnlFilter(filter as 'all' | 'profit' | 'loss');
  };

  const handleRefresh = () => {
    store.fetch();
  };

  const formatPct = (val: number): string => {
    return `${(val * 100).toFixed(1)}%`;
  };

  const renderStatCards = () => {
    if (!store.data) return null;
    const d = store.data;
    const cards = [
      {
        label: '总交易笔数',
        value: String(d.totalTrades),
        sub: `${d.winTrades} 胜 / ${d.loseTrades} 负`,
        positive: false,
      },
      {
        label: '总盈亏',
        value: store.formatMoney(d.totalPnL),
        sub: `胜率 ${formatPct(d.overallWinRate)}`,
        positive: d.totalPnL >= 0,
      },
      {
        label: '盈利笔数',
        value: String(d.winTrades),
        sub: `占比 ${d.totalTrades > 0 ? formatPct(d.winTrades / d.totalTrades) : '0%'}`,
        positive: true,
      },
      {
        label: '亏损笔数',
        value: String(d.loseTrades),
        sub: `占比 ${d.totalTrades > 0 ? formatPct(d.loseTrades / d.totalTrades) : '0%'}`,
        positive: false,
      },
    ];

    return (
      <div className="sp-cards">
        {cards.map((c) => (
          <div className="sp-card" key={c.label}>
            <p className="sp-card-label">{c.label}</p>
            <p
              className={`sp-card-value ${
                c.positive ? 'sp-card-value--positive' : 'sp-card-value--negative'
              }`}
            >
              {c.value}
            </p>
            <p className="sp-card-sub">{c.sub}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderByStockTable = () => {
    const list = store.filteredByStock;
    if (list.length === 0) {
      return (
        <div className="sp-section">
          <p className="sp-section-title">按股票汇总</p>
          <p className="sp-empty">暂无数据</p>
        </div>
      );
    }

    return (
      <div className="sp-section">
        <p className="sp-section-title">按股票汇总</p>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>股票代码</th>
                <th>股票名称</th>
                <th>板块</th>
                <th className="sp-num">交易笔数</th>
                <th className="sp-num">持仓盈亏</th>
                <th className="sp-num">累计盈亏</th>
                <th className="sp-num">胜率</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.stockCode}>
                  <td data-label="股票代码">
                    <StockLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="股票名称">{item.stockName}</td>
                  <td data-label="板块">
                    <span className={`sp-board-tag sp-board-tag--${item.board}`}>{item.board}</span>
                  </td>
                  <td className="sp-num" data-label="交易笔数">{item.tradeCount}</td>
                  <td
                    className={`sp-num ${store.isPnLPositive(item.totalPositionPnL) ? 'sp-positive' : 'sp-negative'}`}
                    data-label="持仓盈亏"
                  >
                    {store.formatMoney(item.totalPositionPnL)}
                  </td>
                  <td
                    className={`sp-num ${store.isPnLPositive(item.totalCumulativePnL) ? 'sp-positive' : 'sp-negative'}`}
                    data-label="累计盈亏"
                  >
                    {store.formatMoney(item.totalCumulativePnL)}
                  </td>
                  <td className="sp-num" data-label="胜率">{formatPct(item.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderByBoardTable = () => {
    const list = store.filteredByBoard;
    if (list.length === 0) {
      return (
        <div className="sp-section">
          <p className="sp-section-title">按板块汇总</p>
          <p className="sp-empty">暂无数据</p>
        </div>
      );
    }

    return (
      <div className="sp-section">
        <p className="sp-section-title">按板块汇总</p>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>板块</th>
                <th className="sp-num">交易笔数</th>
                <th className="sp-num">持仓盈亏</th>
                <th className="sp-num">累计盈亏</th>
                <th className="sp-num">胜率</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.board}>
                  <td data-label="板块">
                    <span className={`sp-board-tag sp-board-tag--${item.board}`}>{item.board}</span>
                  </td>
                  <td className="sp-num" data-label="交易笔数">{item.tradeCount}</td>
                  <td
                    className={`sp-num ${store.isPnLPositive(item.totalPositionPnL) ? 'sp-positive' : 'sp-negative'}`}
                    data-label="持仓盈亏"
                  >
                    {store.formatMoney(item.totalPositionPnL)}
                  </td>
                  <td
                    className={`sp-num ${store.isPnLPositive(item.totalCumulativePnL) ? 'sp-positive' : 'sp-negative'}`}
                    data-label="累计盈亏"
                  >
                    {store.formatMoney(item.totalCumulativePnL)}
                  </td>
                  <td className="sp-num" data-label="胜率">{formatPct(item.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="sp-container">
      <div className="sp-header">
        <div>
          <p className="sp-title">统计汇总</p>
          <p className="sp-subtitle">
            {store.startDate && store.endDate
              ? `${store.startDate} ~ ${store.endDate}`
              : '请选择统计时间范围'}
          </p>
        </div>
        <button
          className="sp-refresh-btn"
          onClick={handleRefresh}
          disabled={store.loading}
        >
          刷新数据
        </button>
      </div>

      {/* 筛选栏 */}
      <div className="sp-filter-bar">
        <label>时间：</label>
        <div className="sp-date-tabs">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`sp-date-tab ${store.dateFilterType === f.key ? 'sp-date-tab--active' : ''}`}
              onClick={() => handleDateFilterClick(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {store.dateFilterType === 'custom' && (
          <>
            <input
              type="date"
              className="sp-input-date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              placeholder="开始日期"
            />
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>~</span>
            <input
              type="date"
              className="sp-input-date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              placeholder="结束日期"
            />
            <button className="sp-btn-primary" onClick={handleCustomSearch}>
              查询
            </button>
          </>
        )}

        <label style={{ marginLeft: '12px' }}>板块：</label>
        <select
          className="sp-select"
          value={store.board}
          onChange={(e) => {
            store.setBoard(e.target.value);
            store.fetch();
          }}
        >
          <option value="">全部板块</option>
          {BOARDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <label style={{ marginLeft: '12px' }}>盈亏：</label>
        <div className="sp-pnl-tabs">
          {PNL_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`sp-pnl-tab ${store.pnlFilter === f.key ? 'sp-pnl-tab--active' : ''}`}
              onClick={() => handlePnlFilterClick(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-main">
        {/* 状态展示 */}
        {store.loading && (
          <div className="sp-status">
            <div className="sp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && !store.loading && (
          <div className="sp-error">
            <span>{store.error}</span>
            <button onClick={handleRefresh}>重试</button>
          </div>
        )}

        {/* 统计卡片 */}
        {!store.loading && !store.error && store.data && renderStatCards()}

        {/* 按股票汇总表格 */}
        {!store.loading && !store.error && store.data && renderByStockTable()}

        {/* 按板块汇总表格 */}
        {!store.loading && !store.error && store.data && renderByBoardTable()}

        {/* 空状态 */}
        {!store.loading && !store.error && !store.data && (
          <p className="sp-empty">请选择筛选条件后点击「刷新数据」</p>
        )}
      </div>
    </div>
  );
});

export default StatisticsPage;
