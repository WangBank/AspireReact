import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './StatsCards.css';

const getToneClass = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '';
  }

  return value >= 0 ? 'stats-card__tone--positive' : 'stats-card__tone--negative';
};

const StatsCards = observer(() => {
  const { dashboardStore } = useStore();

  if (!dashboardStore.data) return null;

  const cards = dashboardStore.data.periodSummaries.length > 0
    ? dashboardStore.data.periodSummaries
    : [
        {
          key: 'today',
          label: '今日盈亏',
          startDate: dashboardStore.latestRecordDate,
          endDate: dashboardStore.latestRecordDate,
          pnl: dashboardStore.data.todayPnL,
          returnRate: null,
          benchmarks: [],
        },
        {
          key: 'week',
          label: '本周盈亏',
          startDate: dashboardStore.latestRecordDate,
          endDate: dashboardStore.latestRecordDate,
          pnl: dashboardStore.data.weekPnL,
          returnRate: null,
          benchmarks: [],
        },
        {
          key: 'month',
          label: '本月盈亏',
          startDate: dashboardStore.latestRecordDate,
          endDate: dashboardStore.latestRecordDate,
          pnl: dashboardStore.data.monthPnL,
          returnRate: null,
          benchmarks: [],
        },
        {
          key: 'cumulative',
          label: '累计盈亏',
          startDate: dashboardStore.latestRecordDate,
          endDate: dashboardStore.latestRecordDate,
          pnl: dashboardStore.data.cumulativePnL,
          returnRate: null,
          benchmarks: [],
        },
      ];

  return (
    <section className="dashboard-section">
      <h2 className="section-title">数据概览</h2>
      <div className="stats-grid">
        {cards.map((card) => {
          const positive = dashboardStore.isPnLPositive(card.pnl);
          return (
            <div key={card.key} className={`stats-card ${positive ? 'stats-card--gain' : 'stats-card--loss'}`}>
              <div className="stats-card__header">
                <span className="stats-card__label">{card.label}</span>
                <span className="stats-card__range">
                  {dashboardStore.formatDateRange(card.startDate, card.endDate)}
                </span>
              </div>
              <span className="stats-card__value">{dashboardStore.formatPnL(card.pnl)}</span>
              <div className="stats-card__return-row">
                <span className="stats-card__return-label">收益率</span>
                <span className={`stats-card__return-value ${getToneClass(card.returnRate)}`.trim()}>
                  {dashboardStore.formatPercent(card.returnRate)}
                </span>
              </div>
              {card.benchmarks.length > 0 ? (
                <div className="stats-card__benchmarks">
                  {card.benchmarks.map((item) => {
                    const relative = card.returnRate != null && item.returnRate != null
                      ? card.returnRate - item.returnRate
                      : null;

                    return (
                      <article className="stats-card__benchmark" key={`${card.key}-${item.key}`}>
                        <span className="stats-card__benchmark-name">{item.name}</span>
                        <span className={`stats-card__benchmark-value ${getToneClass(item.returnRate)}`.trim()}>
                          {dashboardStore.formatPercent(item.returnRate)}
                        </span>
                        <span className={`stats-card__benchmark-gap ${getToneClass(relative)}`.trim()}>
                          {relative == null ? '差值 --' : `差值 ${dashboardStore.formatPercent(relative)}`}
                        </span>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="stats-card__benchmarks stats-card__benchmarks--empty">
                  暂无可对比的指数数据
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

export default StatsCards;
