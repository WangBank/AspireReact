import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import type {
  DailyPnLHeatmapItem,
  PeriodPnLDistributionItem,
  PositionSummaryItem,
} from '../services/StatisticsService';
import type { StatisticsSortField } from '../stores/StatisticsStore';
import SortableHeader from '../components/Table/SortableHeader';
import TablePagination from '../components/Table/TablePagination';
import StockPnLLeaderboard from '../components/StockPnLLeaderboard';
import StockLink from '../components/StockLink';
import StockHistoryLink from '../components/StockHistoryLink';
import { extractDatePart } from '../utils/date';
import './StatisticsPage.css';

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

const getToneClass = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '';
  }

  return value >= 0 ? 'sp-positive' : 'sp-negative';
};

const parseDateOnly = (value: string) => {
  const [year, month, day] = extractDatePart(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const buildHeatmapMonths = (items: DailyPnLHeatmapItem[]) => {
  const monthMap = new Map<string, DailyPnLHeatmapItem[]>();

  items.forEach((item) => {
    const date = parseDateOnly(item.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthMap.get(key) ?? [];
    current.push(item);
    monthMap.set(key, current);
  });

  return Array.from(monthMap.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([key, entries]) => {
      const monthDate = parseDateOnly(`${key}-01`);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
      const entriesByDay = new Map<number, DailyPnLHeatmapItem>();

      entries.forEach((entry) => {
        entriesByDay.set(parseDateOnly(entry.date).getDate(), entry);
      });

      const cells = [];
      for (let index = 0; index < firstWeekday; index += 1) {
        cells.push({ key: `empty-${key}-${index}`, type: 'empty' as const });
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push({
          key: `${key}-${day}`,
          type: 'day' as const,
          day,
          item: entriesByDay.get(day) ?? null,
        });
      }

      return {
        key,
        label: `${year}年${String(month + 1).padStart(2, '0')}月`,
        cells,
      };
    });
};

const StatisticsPage = observer(() => {
  const { statisticsStore: store, stockLeaderboardStore } = useStore();
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    store.setDateFilterType('month');
  }, [store]);

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

  const heatmapMonths = useMemo(
    () => buildHeatmapMonths(store.data?.dailyPnLHeatmap ?? []),
    [store.data?.dailyPnLHeatmap]
  );

  const heatmapMaxAbs = useMemo(() => {
    const values = (store.data?.dailyPnLHeatmap ?? []).map((item) => Math.abs(item.dailyPnL));
    return Math.max(1, ...values);
  }, [store.data?.dailyPnLHeatmap]);

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
      <div className="sp-cards">
        {cards.map((card) => (
          <article className="sp-card" key={card.label}>
            <p className="sp-card-label">{card.label}</p>
            <p className={`sp-card-value ${card.tone}`.trim()}>{card.value}</p>
            <p className="sp-card-sub">{card.sub}</p>
          </article>
        ))}
      </div>
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
      <section className="sp-section">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">交易周期统计</p>
            <p className="sp-section-caption">按一轮建仓到清仓的周期口径统计，不再按单日拆碎</p>
          </div>
        </div>
        <div className="sp-analysis-grid">
          {cards.map((card) => (
            <article className="sp-analysis-card" key={card.label}>
              <p className="sp-analysis-card__label">{card.label}</p>
              <p className={`sp-analysis-card__title ${card.tone}`.trim()}>{card.value}</p>
              <p className="sp-analysis-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>
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
      <section className="sp-section">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">做T专项分析</p>
            <p className="sp-section-caption">统计所有同日买卖的记录表现</p>
          </div>
        </div>
        <div className="sp-mini-grid">
          {cards.map((card) => (
            <article className="sp-mini-card" key={card.label}>
              <p className="sp-mini-card__label">{card.label}</p>
              <p className={`sp-mini-card__value ${card.tone}`.trim()}>{card.value}</p>
              <p className="sp-mini-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>
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
      <section className="sp-section">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">日度节奏</p>
            <p className="sp-section-caption">看哪几天在赚钱，哪几天更容易失控</p>
          </div>
        </div>
        <div className="sp-mini-grid">
          {cards.map((card) => (
            <article className="sp-mini-card" key={card.label}>
              <p className="sp-mini-card__label">{card.label}</p>
              <p className={`sp-mini-card__value ${card.tone}`.trim()}>{card.value}</p>
              <p className="sp-mini-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>
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
      <section className="sp-section">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">胜率与回撤</p>
            <p className="sp-section-caption">按当前统计区间的交易日和账户曲线自动计算</p>
          </div>
        </div>
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
      </section>
    );
  };

  const renderHeatmapSection = () => {
    if (!store.data || heatmapMonths.length === 0) return null;

    return (
      <section className="sp-section">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">收益日历 / 热力图</p>
            <p className="sp-section-caption">红色表示盈利，绿色表示亏损，颜色越深幅度越大</p>
          </div>
        </div>
        <div className="sp-heatmap-months">
          {heatmapMonths.map((month) => (
            <article className="sp-heatmap-month" key={month.key}>
              <div className="sp-heatmap-month__header">
                <span>{month.label}</span>
                <span>{month.cells.filter((cell) => cell.type === 'day' && cell.item).length} 个记录日</span>
              </div>
              <div className="sp-heatmap-weekdays">
                {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
                  <span key={`${month.key}-${label}`}>{label}</span>
                ))}
              </div>
              <div className="sp-heatmap-grid">
                {month.cells.map((cell) => {
                  if (cell.type === 'empty') {
                    return <span key={cell.key} className="sp-heatmap-cell sp-heatmap-cell--empty" />;
                  }

                  const item = cell.item;
                  const alpha = item ? Math.min(0.92, 0.18 + Math.abs(item.dailyPnL) / heatmapMaxAbs * 0.74) : 0.08;
                  const toneClass = item
                    ? item.dailyPnL > 0
                      ? 'sp-heatmap-cell--profit'
                      : item.dailyPnL < 0
                        ? 'sp-heatmap-cell--loss'
                        : 'sp-heatmap-cell--flat'
                    : 'sp-heatmap-cell--blank';

                  return (
                    <span
                      key={cell.key}
                      className={`sp-heatmap-cell ${toneClass}`}
                      style={{ ['--heatmap-alpha' as string]: alpha.toFixed(2) }}
                      title={item ? `${extractDatePart(item.date)} ${store.formatMoney(item.dailyPnL)}` : `${month.label} ${cell.day}日无记录`}
                    >
                      {cell.day}
                    </span>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
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
      <section className="sp-section">
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
      <section className="sp-section">
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
      <section className="sp-section">
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
        <section className="sp-section">
          <p className="sp-section-title">按心魔汇总</p>
          <p className="sp-empty">暂无数据</p>
        </section>
      );
    }

    return (
      <section className="sp-section">
        <div className="sp-section-heading">
          <div>
            <p className="sp-section-title">按心魔汇总</p>
            <p className="sp-section-caption">这里同时看累计盈亏和单票贡献度</p>
          </div>
        </div>
        <div className="sp-table-wrap">
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
        </div>
        <TablePagination
          page={store.stockPage}
          totalPages={store.byStockTotalPages}
          totalItems={store.filteredByStock.length}
          onPageChange={store.setStockPage}
        />
      </section>
    );
  };

  return (
    <div className="sp-container">
      <div className="sp-header">
        <div>
          <p className="sp-title">统计汇总</p>
          <p className="sp-subtitle">{dateRangeText}</p>
        </div>
        <button
          className="sp-refresh-btn"
          onClick={handleRefresh}
          disabled={store.loading}
        >
          刷新数据
        </button>
      </div>

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

        {!store.loading && !store.error && store.data && renderStatCards()}
        {!store.loading && !store.error && store.data && renderCycleSection()}
        {!store.loading && !store.error && store.data && renderDayPatternSection()}
        {!store.loading && !store.error && store.data && renderTTradeSection()}
        {!store.loading && !store.error && store.data && renderAnalysisSection()}
        {!store.loading && !store.error && store.data && renderHeatmapSection()}
        {!store.loading && !store.error && store.data && renderDistributionSection()}
        {!store.loading && !store.error && store.data && renderHoldingSection()}
        {!store.loading && !store.error && store.data && renderBoardRotationSection()}
        {!store.loading && !store.error && store.data && renderByStockTable()}
        {!store.loading && !store.error && <StockPnLLeaderboard />}

        {!store.loading && !store.error && !store.data && (
          <p className="sp-empty">请选择筛选条件后点击「刷新数据」</p>
        )}
      </div>
    </div>
  );
});

export default StatisticsPage;
