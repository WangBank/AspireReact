import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import PnLCalendarExplorer from '../components/PnLCalendarExplorer';
import SectionJumpNav, { type SectionJumpItem } from '../components/SectionJumpNav';
import StockPnLLeaderboard from '../components/StockPnLLeaderboard';
import StatsCards from '../components/Dashboard/StatsCards';
import TradingSnapshot from '../components/Dashboard/TradingSnapshot';
import QuickEntry from '../components/Dashboard/QuickEntry';
import RecentRecords from '../components/Dashboard/RecentRecords';
import './DashboardPage.css';

const DashboardPage = observer(() => {
  const { dashboardStore, stockLeaderboardStore } = useStore();
  const [snapshotReloadToken, setSnapshotReloadToken] = useState(0);

  const latestRecordDateText = dashboardStore.formatRecordDate(dashboardStore.latestRecordDate);
  const latestRecordDailyPnLText = dashboardStore.data
    ? dashboardStore.formatPnL(dashboardStore.latestRecordDailyPnL)
    : '--';

  const handleRefresh = () => {
    void dashboardStore.fetchDashboard();
    void stockLeaderboardStore.fetch(true);
    setSnapshotReloadToken((value) => value + 1);
  };

  const dashboardSections: SectionJumpItem[] = [
    { id: 'dashboard-overview', label: '核心概览' },
    ...(dashboardStore.data ? [{ id: 'dashboard-trading-snapshot', label: '复盘快照' }] : []),
    ...(dashboardStore.data ? [{ id: 'dashboard-calendar', label: '收益日历' }] : []),
    { id: 'dashboard-quick-entry', label: '快捷录入' },
    { id: 'dashboard-recent-records', label: '最近记录' },
    { id: 'dashboard-leaderboard', label: '盈亏榜' },
  ];

  useEffect(() => {
    dashboardStore.fetchDashboard();
  }, [dashboardStore]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">首页概览</h1>
          <p className="dashboard-subtitle">心魔录</p>
          <div className="dashboard-insight-bar">
            <div className="dashboard-insight-card">
              <span className="dashboard-insight-label">最近交易日期</span>
              <span className="dashboard-insight-value">{latestRecordDateText}</span>
            </div>
            <div className="dashboard-insight-card">
              <span className="dashboard-insight-label">当日盈亏</span>
              <span
                className={`dashboard-insight-value ${
                  dashboardStore.data
                    ? dashboardStore.isPnLPositive(dashboardStore.latestRecordDailyPnL)
                      ? 'dashboard-insight-value--positive'
                      : 'dashboard-insight-value--negative'
                    : ''
                }`}
              >
                {latestRecordDailyPnLText}
              </span>
            </div>
          </div>
        </div>
        <button
          className="dashboard-refresh-btn"
          onClick={handleRefresh}
          disabled={dashboardStore.loading}
          type="button"
        >
          {dashboardStore.loading && !dashboardStore.data ? '加载中...' : '刷新数据'}
        </button>
      </header>

      <main className="dashboard-main">
        {dashboardStore.loading && !dashboardStore.data && (
          <div className="dashboard-loading">
            <div className="dashboard-loading__spinner" />
            <span className="dashboard-loading__text">加载中...</span>
          </div>
        )}

        {dashboardStore.error && (
          <div className="dashboard-error">
            <span>{dashboardStore.error}</span>
            <button
              className="dashboard-error__retry"
              onClick={handleRefresh}
              type="button"
            >
              重试
            </button>
          </div>
        )}

        {(dashboardStore.data || !dashboardStore.loading) && (
          <>
            <SectionJumpNav
              title="首页索引"
              items={dashboardSections}
              className="dashboard-index-nav"
            />
            <section id="dashboard-overview" className="dashboard-section section-jump-anchor">
              <StatsCards />
            </section>
            {dashboardStore.data && (
              <TradingSnapshot
                referenceDate={dashboardStore.latestRecordDate}
                reloadToken={snapshotReloadToken}
              />
            )}
            {dashboardStore.data && (
              <section id="dashboard-calendar" className="dashboard-section section-jump-anchor">
                <PnLCalendarExplorer
                  title="收益日历"
                  caption="首页也支持按月、按年、按日切换，方便快速查看资金曲线节奏"
                  items={dashboardStore.data.dailyPnLHeatmap ?? []}
                  emptyText="暂无可展示的收益日历数据"
                  initialMode="year"
                  dayPageSize={15}
                />
              </section>
            )}
            <section id="dashboard-quick-entry" className="dashboard-section section-jump-anchor">
              <QuickEntry />
            </section>
            <section id="dashboard-recent-records" className="dashboard-section section-jump-anchor">
              <RecentRecords />
            </section>
            <section id="dashboard-leaderboard" className="dashboard-section section-jump-anchor">
              <StockPnLLeaderboard />
            </section>
          </>
        )}
      </main>

      <footer className="dashboard-footer">
        <span>心魔录 v1.0</span>
      </footer>
    </div>
  );
});

export default DashboardPage;
