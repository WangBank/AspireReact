import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './StatsCards.css';

const StatsCards = observer(() => {
  const { dashboardStore } = useStore();

  if (!dashboardStore.data) return null;

  const cards = [
    { key: 'todayPnL' as const, label: '今日盈亏' },
    { key: 'weekPnL' as const, label: '本周盈亏' },
    { key: 'monthPnL' as const, label: '本月盈亏' },
    { key: 'cumulativePnL' as const, label: '累计盈亏' },
  ];

  return (
    <section className="dashboard-section">
      <h2 className="section-title">数据概览</h2>
      <div className="stats-grid">
        {cards.map(({ key, label }) => {
          const value = dashboardStore.data![key];
          const positive = dashboardStore.isPnLPositive(value);
          return (
            <div key={key} className={`stats-card ${positive ? 'stats-card--gain' : 'stats-card--loss'}`}>
              <span className="stats-card__label">{label}</span>
              <span className="stats-card__value">{dashboardStore.formatPnL(value)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
});

export default StatsCards;
