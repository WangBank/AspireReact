import { observer } from 'mobx-react-lite';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, TextField } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useStore } from '../stores/StoreProvider';
import type {
  CycleDetailItem,
  PeriodPnLDistributionItem,
  PositionSummaryItem,
  TTradeDetailItem,
  TradeBehaviorSummaryItem,
} from '../services/StatisticsService';
import type { StatisticsSortField } from '../stores/StatisticsStore';
import SectionJumpNav, { type SectionJumpItem } from '../components/SectionJumpNav';
import SortableHeader from '../components/Table/SortableHeader';
import TablePagination from '../components/Table/TablePagination';
import {
  FilterToolbar,
  PageHeader,
  ResponsiveTableShell,
  RouteLoadingFallback,
  SectionCard,
} from '../components/Page';
import StockLink from '../components/StockLink';
import StockHistoryLink from '../components/StockHistoryLink';
import { extractDatePart } from '../utils/date';
import { nextSortState, sortItemsBy, type SortOrder } from '../utils/table';
import './StatisticsPage.css';

const PnLCalendarExplorer = lazy(() => import('../components/PnLCalendarExplorer'));
const StockPnLLeaderboard = lazy(() => import('../components/StockPnLLeaderboard'));

const DATE_FILTERS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
] as const;

const PNL_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'profit', label: '盈利' },
  { key: 'loss', label: '亏损' },
] as const;

const CYCLE_STATUS_FILTERS = [
  { key: 'all', label: '全部状态' },
  { key: 'closed', label: '已结束' },
  { key: 'open', label: '持仓中' },
] as const;

const T_TRADE_STATUS_FILTERS = [
  { key: 'all', label: '全部状态' },
  { key: 'closed', label: '清仓' },
  { key: 'open', label: '留仓' },
] as const;

type CycleStatusFilter = (typeof CYCLE_STATUS_FILTERS)[number]['key'];
type TTradeStatusFilter = (typeof T_TRADE_STATUS_FILTERS)[number]['key'];
type CycleSortField = 'stockCode' | 'stockName' | 'board' | 'startDate' | 'holdingDays' | 'totalPnL';
type TTradeSortField = 'tradeDate' | 'stockCode' | 'stockName' | 'board' | 'buyQuantity' | 'sellQuantity' | 'positionQuantity' | 'dailyPnL';

const getToneClass = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '';
  }

  return value >= 0 ? 'sp-positive' : 'sp-negative';
};

const CYCLE_PAGE_SIZE = 30;
const T_TRADE_PAGE_SIZE = 30;

const paginateLocalList = <T,>(items: T[], page: number, pageSize: number): T[] => {
  const startIndex = Math.max(0, (page - 1) * pageSize);
  return items.slice(startIndex, startIndex + pageSize);
};

const StatisticsPage = observer(() => {
  const { statisticsStore: store, stockLeaderboardStore } = useStore();
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [cyclePage, setCyclePage] = useState(1);
  const [tTradePage, setTTradePage] = useState(1);
  const [cycleStatusFilter, setCycleStatusFilter] = useState<CycleStatusFilter>('all');
  const [cyclePnLFilter, setCyclePnLFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [cycleSortField, setCycleSortField] = useState<CycleSortField>('startDate');
  const [cycleSortOrder, setCycleSortOrder] = useState<SortOrder>('desc');
  const [tTradeStatusFilter, setTTradeStatusFilter] = useState<TTradeStatusFilter>('all');
  const [tTradePnLFilter, setTTradePnLFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [tTradeSortField, setTTradeSortField] = useState<TTradeSortField>('tradeDate');
  const [tTradeSortOrder, setTTradeSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    store.setDateFilterType('month');
  }, [store]);

  useEffect(() => {
    setCyclePage(1);
    setTTradePage(1);
  }, [store.data]);

  const sectionFallback = (
    <RouteLoadingFallback
      label="统计模块加载中..."
      minHeight={220}
      compact
    />
  );

  const handleCycleSort = (field: CycleSortField) => {
    const defaultOrder: SortOrder = field === 'stockCode' || field === 'stockName' || field === 'board' ? 'asc' : 'desc';
    const nextState = nextSortState(cycleSortField, cycleSortOrder, field, defaultOrder);
    setCycleSortField(nextState.field);
    setCycleSortOrder(nextState.order);
    setCyclePage(1);
  };

  const handleTTradeSort = (field: TTradeSortField) => {
    const defaultOrder: SortOrder = field === 'stockCode' || field === 'stockName' || field === 'board' ? 'asc' : 'desc';
    const nextState = nextSortState(tTradeSortField, tTradeSortOrder, field, defaultOrder);
    setTTradeSortField(nextState.field);
    setTTradeSortOrder(nextState.order);
    setTTradePage(1);
  };

  const handleDateFilterClick = (type: (typeof DATE_FILTERS)[number]['key']) => {
    store.setDateFilterType(type);
  };

  const handleCustomSearch = () => {
    store.setCustomDateRange(customStart, customEnd);
    store.fetch();
  };

  const handlePnlFilterClick = (filter: string) => {
    store.setPnlFilter(filter as 'all' | 'profit' | 'loss');
  };

  const handleRefresh = () => {
    void store.fetch();
    void stockLeaderboardStore.fetch(true);
  };

  const dateRangeText = store.startDate && store.endDate
    ? `${store.startDate} ~ ${store.endDate}`
    : store.dateFilterType === 'all'
      ? '全部时间'
      : '请选择统计时间范围';

  const statisticsSections: SectionJumpItem[] = store.data
    ? [
        { id: 'stats-overview', label: '核心指标' },
        ...(store.data.cycleAnalysis ? [{ id: 'stats-cycles', label: '周期统计' }] : []),
        ...(store.data.cycleDetails.length > 0
          ? [{ id: 'stats-cycle-details', label: '周期明细', badge: String(store.data.cycleDetails.length) }]
          : []),
        ...(store.data.dayOutcomes && store.data.streakAnalysis
          ? [{ id: 'stats-day-pattern', label: '日度节奏' }]
          : []),
        ...(store.data.tTradeAnalysis ? [{ id: 'stats-ttrade', label: '做T分析' }] : []),
        ...(store.data.tTradeDetails.length > 0
          ? [{ id: 'stats-ttrade-details', label: '做T明细', badge: String(store.data.tTradeDetails.length) }]
          : []),
        ...((store.data.bySellReason.length > 0
          || store.data.byEmotionTag.length > 0
          || store.data.byTradeTag.length > 0)
          ? [{ id: 'stats-behavior-sell-reason', label: '行为分析' }]
          : []),
        { id: 'stats-analysis', label: '胜率回撤' },
        ...(store.data.dailyPnLHeatmap.length > 0 ? [{ id: 'stats-heatmap', label: '收益日历' }] : []),
        { id: 'stats-distribution', label: '盈亏分布' },
        ...(store.data.positions.length > 0 ? [{ id: 'stats-holdings', label: '持仓天龄' }] : []),
        ...(store.data.boardRotations.length > 0 ? [{ id: 'stats-board-rotation', label: '板块轮动' }] : []),
        { id: 'stats-by-stock', label: '心魔汇总', badge: String(store.filteredByStock.length) },
        { id: 'stats-leaderboard', label: '盈亏榜' },
      ]
    : [];

  const renderStatCards = () => {
    if (!store.data) return null;
    const d = store.data;
    const cards = [
      {
        label: '总盈亏',
        value: store.formatMoney(d.totalPnL),
        sub: '当前统计区间累计结果',
        tone: getToneClass(d.totalPnL),
      },
      {
        label: '已实现盈亏',
        value: store.formatMoney(d.realizedPnL),
        sub: '总盈亏减当前持仓盈亏',
        tone: getToneClass(d.realizedPnL),
      },
      {
        label: '未实现盈亏',
        value: store.formatMoney(d.unrealizedPnL),
        sub: '当前持仓盈亏汇总',
        tone: getToneClass(d.unrealizedPnL),
      },
      {
        label: '净入金修正收益率',
        value: store.formatNullablePercent(d.adjustedReturn?.returnRate ?? null),
        sub: d.adjustedReturn
          ? `起始 ${store.formatMoney(d.adjustedReturn.startAssets)} · 期末 ${store.formatMoney(d.adjustedReturn.endAssets)}`
          : '当前区间没有足够账户数据',
        tone: getToneClass(d.adjustedReturn?.returnRate ?? null),
      },
      {
        label: '银证转账汇总',
        value: store.formatMoney(d.netBankFlow),
        sub: '转入减转出',
        tone: getToneClass(d.netBankFlow),
      },
      {
        label: '当前总额',
        value: store.formatMoney(d.currentTotalAmount),
        sub: '最近账户资金记录总资产',
        tone: getToneClass(d.currentTotalAmount),
      },
      {
        label: '最新资金使用率',
        value: store.formatNullablePercent(d.capitalAnalysis?.latestUtilization ?? null),
        sub: '持仓市值 / 总资产',
        tone: d.capitalAnalysis?.latestUtilization != null && d.capitalAnalysis.latestUtilization >= 0.8
          ? 'sp-negative'
          : 'sp-positive',
      },
      {
        label: '账户波动率',
        value: store.formatNullablePercent(d.capitalAnalysis?.dailyVolatility ?? null),
        sub: '按账户日收益波动估算',
        tone: '',
      },
    ];

    return (
      <SectionCard
        id="stats-overview"
        className="section-jump-anchor"
        title="核心指标"
        description="先看整体盈亏、净入金修正收益率和账户资金状态"
      >
        <div className="sp-cards sp-cards--inside">
          {cards.map((card) => (
            <article className="sp-card" key={card.label}>
              <p className="sp-card-label">{card.label}</p>
              <p className={`sp-card-value ${card.tone}`.trim()}>{card.value}</p>
              <p className="sp-card-sub">{card.sub}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderCycleSection = () => {
    if (!store.data?.cycleAnalysis) return null;
    const cycle = store.data.cycleAnalysis;
    const cards = [
      { label: '周期数', value: `${cycle.totalCycles}`, detail: `${cycle.closedCycles} 个已结束，${cycle.openCycles} 个进行中`, tone: '' },
      { label: '周期胜率', value: store.formatPercent(cycle.closedWinRate), detail: '仅统计已清仓周期', tone: getToneClass(cycle.closedWinRate - 0.5) },
      { label: '平均单周期盈利', value: store.formatMoney(cycle.averageProfitPerCycle), detail: '已结束盈利周期均值', tone: getToneClass(cycle.averageProfitPerCycle) },
      { label: '平均单周期亏损', value: store.formatMoney(cycle.averageLossPerCycle), detail: '已结束亏损周期均值', tone: getToneClass(cycle.averageLossPerCycle) },
      { label: '平均持有天数', value: `${cycle.averageHoldingDays.toFixed(1)} 天`, detail: '优先按已结束周期统计', tone: '' },
      { label: '最大单周期盈亏', value: `${store.formatMoney(cycle.maxProfitCyclePnL)} / ${store.formatMoney(cycle.maxLossCyclePnL)}`, detail: '最大盈利 / 最大亏损', tone: '' },
    ];

    return (
      <SectionCard
        id="stats-cycles"
        className="section-jump-anchor"
        title="交易周期统计"
        description="按一轮建仓到清仓的周期口径统计，不再按单日拆碎"
      >
        <div className="sp-analysis-grid">
          {cards.map((card) => (
            <article className="sp-analysis-card" key={card.label}>
              <p className="sp-analysis-card__label">{card.label}</p>
              <p className={`sp-analysis-card__title ${card.tone}`.trim()}>{card.value}</p>
              <p className="sp-analysis-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderCycleDetailSection = () => {
    if (!store.data || store.data.cycleDetails.length === 0) return null;

    const cycleDetails = store.data.cycleDetails.filter((item: CycleDetailItem) => {
      if (cycleStatusFilter === 'closed' && !item.isClosed) {
        return false;
      }

      if (cycleStatusFilter === 'open' && item.isClosed) {
        return false;
      }

      if (cyclePnLFilter === 'profit' && item.totalPnL < 0) {
        return false;
      }

      if (cyclePnLFilter === 'loss' && item.totalPnL >= 0) {
        return false;
      }

      return true;
    });

    const sortedCycleDetails = sortItemsBy(cycleDetails, [
      {
        getValue: (item: CycleDetailItem) => {
          switch (cycleSortField) {
            case 'stockCode':
              return item.stockCode;
            case 'stockName':
              return item.stockName;
            case 'board':
              return item.board;
            case 'holdingDays':
              return item.holdingDays;
            case 'totalPnL':
              return item.totalPnL;
            case 'startDate':
            default:
              return extractDatePart(item.startDate);
          }
        },
        order: cycleSortOrder,
      },
      { getValue: item => item.totalPnL, order: 'desc' },
      { getValue: item => extractDatePart(item.startDate), order: 'desc' },
      { getValue: item => item.stockCode, order: 'asc' },
    ]);

    const cycleTotalPages = Math.max(1, Math.ceil(sortedCycleDetails.length / CYCLE_PAGE_SIZE));
    const currentCyclePage = Math.min(cyclePage, cycleTotalPages);
    const pagedCycleDetails = paginateLocalList(sortedCycleDetails, currentCyclePage, CYCLE_PAGE_SIZE);

    return (
      <ResponsiveTableShell
        id="stats-cycle-details"
        className="section-jump-anchor"
        title="交易周期明细"
        description="把每一轮建仓到清仓拉直看，方便你复盘哪一轮做对了，哪一轮拖泥带水。"
        toolbar={(
          <div className="sp-section-toolbar">
            <div className="sp-chip-groups">
              <div className="sp-chip-group">
                <span className="sp-chip-group__label">状态</span>
                <div className="sp-chip-list">
                  {CYCLE_STATUS_FILTERS.map((filter) => (
                    <button
                      key={`cycle-status-${filter.key}`}
                      type="button"
                      className={`sp-chip ${cycleStatusFilter === filter.key ? 'sp-chip--active' : ''}`.trim()}
                      onClick={() => {
                        setCycleStatusFilter(filter.key);
                        setCyclePage(1);
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sp-chip-group">
                <span className="sp-chip-group__label">盈亏</span>
                <div className="sp-chip-list">
                  {PNL_FILTERS.map((filter) => (
                    <button
                      key={`cycle-pnl-${filter.key}`}
                      type="button"
                      className={`sp-chip ${cyclePnLFilter === filter.key ? 'sp-chip--active' : ''}`.trim()}
                      onClick={() => {
                        setCyclePnLFilter(filter.key);
                        setCyclePage(1);
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="sp-section-meta">当前 {sortedCycleDetails.length} / {store.data.cycleDetails.length} 个周期</div>
          </div>
        )}
        footer={sortedCycleDetails.length === 0 ? undefined : (
          <TablePagination
            page={currentCyclePage}
            totalPages={cycleTotalPages}
            totalItems={sortedCycleDetails.length}
            onPageChange={setCyclePage}
          />
        )}
      >
        {sortedCycleDetails.length === 0 ? (
          <p className="sp-empty sp-empty--compact">当前筛选条件下没有周期记录。</p>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <th>状态</th>
                <SortableHeader field="stockCode" currentField={cycleSortField} currentOrder={cycleSortOrder} onSort={handleCycleSort}>
                  代码
                </SortableHeader>
                <SortableHeader field="stockName" currentField={cycleSortField} currentOrder={cycleSortOrder} onSort={handleCycleSort}>
                  名称
                </SortableHeader>
                <SortableHeader field="board" currentField={cycleSortField} currentOrder={cycleSortOrder} onSort={handleCycleSort}>
                  板块
                </SortableHeader>
                <SortableHeader field="startDate" currentField={cycleSortField} currentOrder={cycleSortOrder} onSort={handleCycleSort}>
                  周期区间
                </SortableHeader>
                <SortableHeader field="holdingDays" currentField={cycleSortField} currentOrder={cycleSortOrder} onSort={handleCycleSort} className="sp-num">
                  持有天数
                </SortableHeader>
                <SortableHeader field="totalPnL" currentField={cycleSortField} currentOrder={cycleSortOrder} onSort={handleCycleSort} className="sp-num">
                  周期盈亏
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {pagedCycleDetails.map((item: CycleDetailItem) => (
                <tr key={`${item.stockCode}-${item.startDate}-${item.endDate || 'open'}`}>
                  <td data-label="状态">
                    <span className={`sp-status-badge ${item.isClosed ? 'sp-status-badge--closed' : 'sp-status-badge--open'}`}>
                      {item.isClosed ? '已结束' : '持仓中'}
                    </span>
                  </td>
                  <td data-label="代码">
                    <StockLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="名称">
                    <StockHistoryLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="板块">
                    <span className={`sp-board-tag sp-board-tag--${item.board}`}>{item.board}</span>
                  </td>
                  <td data-label="周期区间">
                    {item.endDate
                      ? store.formatDateRange(item.startDate, item.endDate)
                      : `${extractDatePart(item.startDate)} ~ 持仓中`}
                  </td>
                  <td data-label="持有天数" className="sp-num">{item.holdingDays}</td>
                  <td data-label="周期盈亏" className={`sp-num ${getToneClass(item.totalPnL)}`.trim()}>
                    {store.formatMoney(item.totalPnL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ResponsiveTableShell>
    );
  };

  const renderTTradeSection = () => {
    if (!store.data?.tTradeAnalysis) return null;
    const t = store.data.tTradeAnalysis;
    const cards = [
      { label: '做T次数', value: `${t.tradeCount}`, detail: `${t.winCount} 胜 / ${t.loseCount} 负`, tone: '' },
      { label: '做T胜率', value: store.formatPercent(t.winRate), detail: '同日有买有卖的记录', tone: getToneClass(t.winRate - 0.5) },
      { label: '做T总盈亏', value: store.formatMoney(t.totalPnL), detail: '做T记录当日盈亏合计', tone: getToneClass(t.totalPnL) },
      { label: '做T平均收益', value: store.formatMoney(t.averagePnL), detail: '单笔做T平均盈亏', tone: getToneClass(t.averagePnL) },
    ];

    return (
      <SectionCard
        id="stats-ttrade"
        className="section-jump-anchor"
        title="做T专项分析"
        description="统计所有同日买卖的记录表现"
      >
        <div className="sp-mini-grid">
          {cards.map((card) => (
            <article className="sp-mini-card" key={card.label}>
              <p className="sp-mini-card__label">{card.label}</p>
              <p className={`sp-mini-card__value ${card.tone}`.trim()}>{card.value}</p>
              <p className="sp-mini-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderTTradeDetailSection = () => {
    if (!store.data || store.data.tTradeDetails.length === 0) return null;

    const tTradeDetails = store.data.tTradeDetails.filter((item: TTradeDetailItem) => {
      const isOpen = !item.isLiquidated && item.positionQuantity > 0;

      if (tTradeStatusFilter === 'closed' && isOpen) {
        return false;
      }

      if (tTradeStatusFilter === 'open' && !isOpen) {
        return false;
      }

      if (tTradePnLFilter === 'profit' && item.dailyPnL < 0) {
        return false;
      }

      if (tTradePnLFilter === 'loss' && item.dailyPnL >= 0) {
        return false;
      }

      return true;
    });

    const sortedTTradeDetails = sortItemsBy(tTradeDetails, [
      {
        getValue: (item: TTradeDetailItem) => {
          switch (tTradeSortField) {
            case 'stockCode':
              return item.stockCode;
            case 'stockName':
              return item.stockName;
            case 'board':
              return item.board;
            case 'buyQuantity':
              return item.buyQuantity;
            case 'sellQuantity':
              return item.sellQuantity;
            case 'positionQuantity':
              return item.positionQuantity;
            case 'dailyPnL':
              return item.dailyPnL;
            case 'tradeDate':
            default:
              return extractDatePart(item.tradeDate);
          }
        },
        order: tTradeSortOrder,
      },
      { getValue: item => item.dailyPnL, order: 'desc' },
      { getValue: item => extractDatePart(item.tradeDate), order: 'desc' },
      { getValue: item => item.stockCode, order: 'asc' },
    ]);

    const totalPages = Math.max(1, Math.ceil(sortedTTradeDetails.length / T_TRADE_PAGE_SIZE));
    const currentPage = Math.min(tTradePage, totalPages);
    const pagedTTradeDetails = paginateLocalList(sortedTTradeDetails, currentPage, T_TRADE_PAGE_SIZE);

    return (
      <ResponsiveTableShell
        id="stats-ttrade-details"
        className="section-jump-anchor"
        title="做T明细"
        description="按单日做T记录逐条展开，回看哪些日内动作真正改善了收益，哪些只是增加了波动。"
        toolbar={(
          <div className="sp-section-toolbar">
            <div className="sp-chip-groups">
              <div className="sp-chip-group">
                <span className="sp-chip-group__label">状态</span>
                <div className="sp-chip-list">
                  {T_TRADE_STATUS_FILTERS.map((filter) => (
                    <button
                      key={`ttrade-status-${filter.key}`}
                      type="button"
                      className={`sp-chip ${tTradeStatusFilter === filter.key ? 'sp-chip--active' : ''}`.trim()}
                      onClick={() => {
                        setTTradeStatusFilter(filter.key);
                        setTTradePage(1);
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sp-chip-group">
                <span className="sp-chip-group__label">盈亏</span>
                <div className="sp-chip-list">
                  {PNL_FILTERS.map((filter) => (
                    <button
                      key={`ttrade-pnl-${filter.key}`}
                      type="button"
                      className={`sp-chip ${tTradePnLFilter === filter.key ? 'sp-chip--active' : ''}`.trim()}
                      onClick={() => {
                        setTTradePnLFilter(filter.key);
                        setTTradePage(1);
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="sp-section-meta">当前 {sortedTTradeDetails.length} / {store.data.tTradeDetails.length} 条做T</div>
          </div>
        )}
        footer={sortedTTradeDetails.length === 0 ? undefined : (
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={sortedTTradeDetails.length}
            onPageChange={setTTradePage}
          />
        )}
      >
        {sortedTTradeDetails.length === 0 ? (
          <p className="sp-empty sp-empty--compact">当前筛选条件下没有做T记录。</p>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <SortableHeader field="tradeDate" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort}>
                  日期
                </SortableHeader>
                <SortableHeader field="stockCode" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort}>
                  代码
                </SortableHeader>
                <SortableHeader field="stockName" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort}>
                  名称
                </SortableHeader>
                <SortableHeader field="board" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort}>
                  板块
                </SortableHeader>
                <SortableHeader field="buyQuantity" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort}>
                  买入
                </SortableHeader>
                <SortableHeader field="sellQuantity" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort}>
                  卖出
                </SortableHeader>
                <SortableHeader field="positionQuantity" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort} className="sp-num">
                  剩余持仓
                </SortableHeader>
                <th>状态</th>
                <SortableHeader field="dailyPnL" currentField={tTradeSortField} currentOrder={tTradeSortOrder} onSort={handleTTradeSort} className="sp-num">
                  当日盈亏
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {pagedTTradeDetails.map((item: TTradeDetailItem) => (
                <tr key={`${item.tradeDate}-${item.stockCode}-${item.buyQuantity}-${item.sellQuantity}`}>
                  <td data-label="日期">{extractDatePart(item.tradeDate)}</td>
                  <td data-label="代码">
                    <StockLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="名称">
                    <StockHistoryLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="板块">
                    <span className={`sp-board-tag sp-board-tag--${item.board}`}>{item.board}</span>
                  </td>
                  <td data-label="买入">{item.buyQuantity.toLocaleString()} @ {item.buyPrice.toFixed(3)}</td>
                  <td data-label="卖出">{item.sellQuantity.toLocaleString()} @ {item.sellPrice.toFixed(3)}</td>
                  <td data-label="剩余持仓" className="sp-num">{item.positionQuantity.toLocaleString()}</td>
                  <td data-label="状态">
                    <span className={`sp-status-badge ${item.isLiquidated || item.positionQuantity <= 0 ? 'sp-status-badge--closed' : 'sp-status-badge--open'}`}>
                      {item.isLiquidated || item.positionQuantity <= 0 ? '清仓' : '持仓'}
                    </span>
                  </td>
                  <td data-label="当日盈亏" className={`sp-num ${getToneClass(item.dailyPnL)}`.trim()}>
                    {store.formatMoney(item.dailyPnL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ResponsiveTableShell>
    );
  };

  const renderBehaviorSection = (
    sectionId: string,
    title: string,
    labelHeader: string,
    caption: string,
    list: TradeBehaviorSummaryItem[],
    emptyText: string,
  ) => {
    if (list.length === 0) {
      return (
        <SectionCard
          id={sectionId}
          className="section-jump-anchor"
          title={title}
          description={caption}
        >
          <p className="sp-empty">{emptyText}</p>
        </SectionCard>
      );
    }

    return (
      <ResponsiveTableShell
        id={sectionId}
        className="section-jump-anchor"
        title={title}
        description={caption}
      >
        <table className="sp-table">
            <thead>
              <tr>
                <th>{labelHeader}</th>
                <th className="sp-num">记录数</th>
                <th className="sp-num">胜 / 负</th>
                <th className="sp-num">胜率</th>
                <th className="sp-num">总盈亏</th>
                <th className="sp-num">平均盈亏</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={`${title}-${item.label}`}>
                  <td data-label={labelHeader}>{item.label}</td>
                  <td data-label="记录数" className="sp-num">{item.tradeCount}</td>
                  <td data-label="胜 / 负" className="sp-num">{item.winCount} / {item.loseCount}</td>
                  <td data-label="胜率" className="sp-num">{store.formatPercent(item.winRate)}</td>
                  <td data-label="总盈亏" className={`sp-num ${getToneClass(item.totalPnL)}`.trim()}>
                    {store.formatMoney(item.totalPnL)}
                  </td>
                  <td data-label="平均盈亏" className={`sp-num ${getToneClass(item.averagePnL)}`.trim()}>
                    {store.formatMoney(item.averagePnL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </ResponsiveTableShell>
    );
  };

  const renderDayPatternSection = () => {
    if (!store.data?.dayOutcomes || !store.data?.streakAnalysis) return null;
    const outcome = store.data.dayOutcomes;
    const streak = store.data.streakAnalysis;

    const cards = [
      {
        label: '盈利天数占比',
        value: `${outcome.profitDays} 天 · ${store.formatPercent(outcome.profitDayRate)}`,
        detail: `亏损 ${outcome.lossDays} 天，平盘 ${outcome.flatDays} 天`,
        tone: 'sp-positive',
      },
      {
        label: '亏损天数占比',
        value: `${outcome.lossDays} 天 · ${store.formatPercent(outcome.lossDayRate)}`,
        detail: '亏损日越集中，越值得回看执行',
        tone: 'sp-negative',
      },
      {
        label: '最长连赢',
        value: streak.maxWinDays > 0 ? `${streak.maxWinDays} 天` : '--',
        detail: streak.maxWinStartDate && streak.maxWinEndDate
          ? `${store.formatDateRange(streak.maxWinStartDate, streak.maxWinEndDate)}`
          : '暂无连续盈利区间',
        tone: 'sp-positive',
      },
      {
        label: '最长连亏',
        value: streak.maxLossDays > 0 ? `${streak.maxLossDays} 天` : '--',
        detail: streak.maxLossStartDate && streak.maxLossEndDate
          ? `${store.formatDateRange(streak.maxLossStartDate, streak.maxLossEndDate)}`
          : '暂无连续亏损区间',
        tone: 'sp-negative',
      },
    ];

    return (
      <SectionCard
        id="stats-day-pattern"
        className="section-jump-anchor"
        title="日度节奏"
        description="看哪几天在赚钱，哪几天更容易失控"
      >
        <div className="sp-mini-grid">
          {cards.map((card) => (
            <article className="sp-mini-card" key={card.label}>
              <p className="sp-mini-card__label">{card.label}</p>
              <p className={`sp-mini-card__value ${card.tone}`.trim()}>{card.value}</p>
              <p className="sp-mini-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderAnalysisSection = () => {
    if (!store.data) return null;

    const {
      bestWinRateDay,
      worstWinRateDay,
      bestProfitInterval,
      maxDrawdownInterval,
    } = store.data;

    const cards = [
      {
        label: '胜率最高交易日',
        title: bestWinRateDay
          ? `${store.formatDate(bestWinRateDay.date)} · ${store.formatPercent(bestWinRateDay.winRate)}`
          : '暂无数据',
        detail: bestWinRateDay
          ? `${bestWinRateDay.winCount} 胜 ${bestWinRateDay.loseCount} 负 · ${store.formatMoney(bestWinRateDay.totalPnL)}`
          : '当前区间没有可统计的交易日胜率',
        tone: bestWinRateDay ? getToneClass(bestWinRateDay.totalPnL) : '',
      },
      {
        label: '胜率最低交易日',
        title: worstWinRateDay
          ? `${store.formatDate(worstWinRateDay.date)} · ${store.formatPercent(worstWinRateDay.winRate)}`
          : '暂无数据',
        detail: worstWinRateDay
          ? `${worstWinRateDay.winCount} 胜 ${worstWinRateDay.loseCount} 负 · ${store.formatMoney(worstWinRateDay.totalPnL)}`
          : '当前区间没有可统计的交易日胜率',
        tone: worstWinRateDay ? getToneClass(worstWinRateDay.totalPnL) : '',
      },
      {
        label: '最大盈利区间',
        title: bestProfitInterval
          ? `${store.formatDateRange(bestProfitInterval.startDate, bestProfitInterval.endDate)}`
          : '暂无数据',
        detail: bestProfitInterval
          ? `${bestProfitInterval.tradingDays} 天 · ${store.formatMoney(bestProfitInterval.totalPnL)}`
          : '当前区间没有可分析的账户或交易数据',
        tone: bestProfitInterval ? getToneClass(bestProfitInterval.totalPnL) : '',
      },
      {
        label: '最大回撤区间',
        title: maxDrawdownInterval
          ? `${store.formatDateRange(maxDrawdownInterval.peakDate, maxDrawdownInterval.troughDate)}`
          : '暂无数据',
        detail: maxDrawdownInterval
          ? `${store.formatMoney(-maxDrawdownInterval.drawdownAmount)} · ${store.formatPercent(maxDrawdownInterval.drawdownRate)}`
          : '当前区间没有可分析的账户或交易数据',
        tone: 'sp-negative',
        extra: maxDrawdownInterval?.recoveryDays != null
          ? `回撤谷底后 ${maxDrawdownInterval.recoveryDays} 天恢复新高（${extractDatePart(maxDrawdownInterval.recoveryDate)})`
          : '回撤后尚未恢复新高或暂无恢复数据',
      },
    ];

    return (
      <SectionCard
        id="stats-analysis"
        className="section-jump-anchor"
        title="胜率与回撤"
        description="按当前统计区间的交易日和账户曲线自动计算"
      >
        <div className="sp-analysis-grid">
          {cards.map((card) => (
            <article className="sp-analysis-card" key={card.label}>
              <p className="sp-analysis-card__label">{card.label}</p>
              <p className={`sp-analysis-card__title ${card.tone}`.trim()}>{card.title}</p>
              <p className="sp-analysis-card__detail">{card.detail}</p>
              {'extra' in card ? <p className="sp-analysis-card__extra">{card.extra}</p> : null}
            </article>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderHeatmapSection = () => {
    if (!store.data || store.data.dailyPnLHeatmap.length === 0) return null;

    return (
      <section id="stats-heatmap" className="section-jump-anchor">
        <Suspense fallback={sectionFallback}>
          <PnLCalendarExplorer
            title="收益日历 / 热力图"
            caption="支持按月、按年、按日切换，红色表示盈利，绿色表示亏损"
            items={store.data.dailyPnLHeatmap}
            dayPageSize={30}
          />
        </Suspense>
      </section>
    );
  };

  const renderDistributionTable = (
    title: string,
    caption: string,
    items: PeriodPnLDistributionItem[]
  ) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <article className="sp-distribution-panel">
        <div className="sp-distribution-panel__header">
          <p className="sp-distribution-panel__title">{title}</p>
          <p className="sp-distribution-panel__caption">{caption}</p>
        </div>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>周期</th>
                <th>时间范围</th>
                <th className="sp-num">盈亏</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 8).map((item) => (
                <tr key={`${title}-${item.label}`}>
                  <td data-label="周期">{item.label}</td>
                  <td data-label="时间范围">{store.formatDateRange(item.startDate, item.endDate)}</td>
                  <td data-label="盈亏" className={`sp-num ${getToneClass(item.totalPnL)}`.trim()}>
                    {store.formatMoney(item.totalPnL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    );
  };

  const renderDistributionSection = () => {
    if (!store.data) return null;

    return (
      <section id="stats-distribution" className="sp-section section-jump-anchor">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">盈亏分布</p>
            <p className="sp-section-caption">按周、按月、按季度回看节奏变化</p>
          </div>
        </div>
        <div className="sp-distribution-grid">
          {renderDistributionTable('按周分布', '最近 8 个周区间', store.data.weeklyPnL)}
          {renderDistributionTable('按月分布', '最近 8 个月区间', store.data.monthlyPnL)}
          {renderDistributionTable('按季度分布', '最近 8 个季度区间', store.data.quarterlyPnL)}
        </div>
      </section>
    );
  };

  const renderHoldingSection = () => {
    if (!store.data || store.data.positions.length === 0) return null;

    return (
      <section id="stats-holdings" className="sp-section section-jump-anchor">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">当前持仓天龄</p>
            <p className="sp-section-caption">识别哪些仓位已经拿得很久，哪些是“老仓”</p>
          </div>
        </div>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>板块</th>
                <th>建仓日</th>
                <th className="sp-num">持有天数</th>
                <th className="sp-num">持仓数量</th>
                <th className="sp-num">持仓盈亏</th>
              </tr>
            </thead>
            <tbody>
              {[...store.data.positions]
                .sort((left: PositionSummaryItem, right: PositionSummaryItem) => right.holdingDays - left.holdingDays)
                .map((item: PositionSummaryItem) => (
                  <tr key={`holding-${item.stockCode}`}>
                    <td data-label="代码">
                      <StockLink stockCode={item.stockCode} stockName={item.stockName} />
                    </td>
                    <td data-label="名称">
                      <StockHistoryLink stockCode={item.stockCode} stockName={item.stockName} />
                    </td>
                    <td data-label="板块">{item.board}</td>
                    <td data-label="建仓日">{item.openDate ? extractDatePart(item.openDate) : '--'}</td>
                    <td data-label="持有天数" className="sp-num">{item.holdingDays}</td>
                    <td data-label="持仓数量" className="sp-num">{item.positionQuantity}</td>
                    <td data-label="持仓盈亏" className={`sp-num ${getToneClass(item.positionPnL)}`.trim()}>
                      {store.formatMoney(item.positionPnL)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderBoardRotationSection = () => {
    if (!store.data || store.data.boardRotations.length === 0) return null;

    return (
      <section id="stats-board-rotation" className="sp-section section-jump-anchor">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">板块轮动复盘</p>
            <p className="sp-section-caption">虽然主视图不常驻按板块汇总，这里保留为可选分析视角</p>
          </div>
        </div>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>板块</th>
                <th className="sp-num">累计盈亏</th>
                <th className="sp-num">贡献度</th>
                <th className="sp-num">活跃天数</th>
                <th className="sp-num">盈利天数</th>
                <th className="sp-num">亏损天数</th>
                <th className="sp-num">盈利日占比</th>
              </tr>
            </thead>
            <tbody>
              {store.data.boardRotations.map((item) => (
                <tr key={`board-${item.board}`}>
                  <td data-label="板块">
                    <span className={`sp-board-tag sp-board-tag--${item.board}`}>{item.board}</span>
                  </td>
                  <td data-label="累计盈亏" className={`sp-num ${getToneClass(item.totalPnL)}`.trim()}>
                    {store.formatMoney(item.totalPnL)}
                  </td>
                  <td data-label="贡献度" className="sp-num">
                    {store.formatPercent(item.contributionRate)}
                  </td>
                  <td data-label="活跃天数" className="sp-num">{item.activeDays}</td>
                  <td data-label="盈利天数" className="sp-num">{item.profitDays}</td>
                  <td data-label="亏损天数" className="sp-num">{item.lossDays}</td>
                  <td data-label="盈利日占比" className="sp-num">{store.formatPercent(item.winDayRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderByStockTable = () => {
    const list = store.pagedByStock;
    if (list.length === 0) {
      return (
        <SectionCard
          id="stats-by-stock"
          className="section-jump-anchor"
          title="按心魔汇总"
        >
          <p className="sp-empty">暂无数据</p>
        </SectionCard>
      );
    }

    return (
      <ResponsiveTableShell
        id="stats-by-stock"
        className="section-jump-anchor"
        title="按心魔汇总"
        description="这里同时看累计盈亏和单票贡献度"
        footer={(
          <TablePagination
            page={store.stockPage}
            totalPages={store.byStockTotalPages}
            totalItems={store.filteredByStock.length}
            onPageChange={store.setStockPage}
          />
        )}
      >
        <table className="sp-table">
            <thead>
              <tr>
                <SortableHeader field={'stockCode' as StatisticsSortField} currentField={store.stockSortField} currentOrder={store.stockSortOrder} onSort={store.toggleStockSort}>
                  心魔代码
                </SortableHeader>
                <SortableHeader field={'stockName' as StatisticsSortField} currentField={store.stockSortField} currentOrder={store.stockSortOrder} onSort={store.toggleStockSort}>
                  心魔名称
                </SortableHeader>
                <SortableHeader field={'board' as StatisticsSortField} currentField={store.stockSortField} currentOrder={store.stockSortOrder} onSort={store.toggleStockSort}>
                  板块
                </SortableHeader>
                <SortableHeader field={'totalCumulativePnL' as StatisticsSortField} currentField={store.stockSortField} currentOrder={store.stockSortOrder} onSort={store.toggleStockSort} className="sp-num">
                  累计盈亏
                </SortableHeader>
                <SortableHeader field={'contributionRate' as StatisticsSortField} currentField={store.stockSortField} currentOrder={store.stockSortOrder} onSort={store.toggleStockSort} className="sp-num">
                  贡献度
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.stockCode}>
                  <td data-label="心魔代码">
                    <StockLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="心魔名称">
                    <StockHistoryLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="板块">
                    <span className={`sp-board-tag sp-board-tag--${item.board}`}>{item.board}</span>
                  </td>
                  <td
                    className={`sp-num ${getToneClass(item.totalCumulativePnL)}`.trim()}
                    data-label="累计盈亏"
                  >
                    {store.formatMoney(item.totalCumulativePnL)}
                  </td>
                  <td className="sp-num" data-label="贡献度">
                    {store.formatPercent(item.contributionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </ResponsiveTableShell>
    );
  };

  return (
    <div className="sp-container">
      <div className="sp-header">
        <PageHeader
          title="统计汇总"
          subtitle={dateRangeText}
          actions={(
            <Button
              onClick={handleRefresh}
              disabled={store.loading}
              type="button"
              variant="contained"
              startIcon={store.loading ? <CircularProgress size={16} color="inherit" /> : <RefreshRoundedIcon />}
              sx={{ minWidth: 132 }}
            >
              刷新数据
            </Button>
          )}
        />
      </div>

      <div className="sp-filter-bar">
        <FilterToolbar
          title="统计筛选"
          description="先确定统计时间，再按盈亏方向缩小观察范围。自定义时间会直接回刷整页数据。"
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.25}
              sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
            >
              <Box sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 700 }}>时间</Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {DATE_FILTERS.map((filter) => (
                  <Chip
                    key={filter.key}
                    label={filter.label}
                    clickable
                    color={store.dateFilterType === filter.key ? 'primary' : 'default'}
                    variant={store.dateFilterType === filter.key ? 'filled' : 'outlined'}
                    onClick={() => handleDateFilterClick(filter.key)}
                  />
                ))}
              </Stack>
            </Stack>

            {store.dateFilterType === 'custom' ? (
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
              >
                <TextField
                  type="date"
                  label="开始日期"
                  size="small"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  type="date"
                  label="结束日期"
                  size="small"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button variant="contained" onClick={handleCustomSearch}>
                  查询
                </Button>
              </Stack>
            ) : null}

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.25}
              sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
            >
              <Box sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 700 }}>盈亏</Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {PNL_FILTERS.map((filter) => (
                  <Chip
                    key={filter.key}
                    label={filter.label}
                    clickable
                    color={store.pnlFilter === filter.key ? 'primary' : 'default'}
                    variant={store.pnlFilter === filter.key ? 'filled' : 'outlined'}
                    onClick={() => handlePnlFilterClick(filter.key)}
                  />
                ))}
              </Stack>
            </Stack>
          </Stack>
        </FilterToolbar>
      </div>

      <div className="sp-main">
        {store.loading && (
          <RouteLoadingFallback label="统计数据加载中..." minHeight={240} compact />
        )}

        {store.error && !store.loading && (
          <Alert
            severity="error"
            action={(
              <Button color="inherit" size="small" onClick={handleRefresh}>
                重试
              </Button>
            )}
            sx={{ mb: 3 }}
          >
            {store.error}
          </Alert>
        )}

        {!store.loading && !store.error && store.data && (
          <SectionJumpNav
            title="统计索引"
            items={statisticsSections}
            className="sp-index-nav"
          />
        )}
        {!store.loading && !store.error && store.data && renderStatCards()}
        {!store.loading && !store.error && store.data && renderCycleSection()}
        {!store.loading && !store.error && store.data && renderCycleDetailSection()}
        {!store.loading && !store.error && store.data && renderDayPatternSection()}
        {!store.loading && !store.error && store.data && renderTTradeSection()}
        {!store.loading && !store.error && store.data && renderTTradeDetailSection()}
        {!store.loading && !store.error && store.data && renderBehaviorSection(
          'stats-behavior-sell-reason',
          '卖出原因分析',
          '卖出原因',
          '把所有有卖出动作且填写了卖出原因的记录聚合起来看，帮助校验你的离场逻辑',
          store.data.bySellReason,
          '当前区间还没有填写卖出原因的数据',
        )}
        {!store.loading && !store.error && store.data && renderBehaviorSection(
          'stats-behavior-emotion',
          '情绪标签分析',
          '情绪标签',
          '把记录过的情绪逐个聚合，看哪种情绪状态最容易赚钱，哪种最容易伤到账户',
          store.data.byEmotionTag,
          '当前区间还没有填写情绪标签的数据',
        )}
        {!store.loading && !store.error && store.data && renderBehaviorSection(
          'stats-behavior-trade-tag',
          '交易标签分析',
          '交易标签',
          '把每条交易打过的标签聚合起来看，方便识别哪种模式、动作或执行状态最稳定',
          store.data.byTradeTag,
          '当前区间还没有填写交易标签的数据',
        )}
        {!store.loading && !store.error && store.data && renderAnalysisSection()}
        {!store.loading && !store.error && store.data && renderHeatmapSection()}
        {!store.loading && !store.error && store.data && renderDistributionSection()}
        {!store.loading && !store.error && store.data && renderHoldingSection()}
        {!store.loading && !store.error && store.data && renderBoardRotationSection()}
        {!store.loading && !store.error && store.data && renderByStockTable()}
        {!store.loading && !store.error && (
          <section id="stats-leaderboard" className="section-jump-anchor">
            <Suspense fallback={sectionFallback}>
              <StockPnLLeaderboard />
            </Suspense>
          </section>
        )}

        {!store.loading && !store.error && !store.data && (
          <SectionCard title="暂无统计结果" description="请选择筛选条件后点击刷新数据。">
            <p className="sp-empty">请选择筛选条件后点击「刷新数据」</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
});

export default StatisticsPage;
