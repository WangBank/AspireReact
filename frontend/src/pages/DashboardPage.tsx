import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useStore } from '../stores/StoreProvider';
import StatsCards from '../components/Dashboard/StatsCards';
import QuickEntry from '../components/Dashboard/QuickEntry';
import RecentRecords from '../components/Dashboard/RecentRecords';
import './DashboardPage.css';

const DashboardPage = observer(() => {
  const { dashboardStore } = useStore();

  const latestRecordDateText = dashboardStore.formatRecordDate(dashboardStore.latestRecordDate);
  const latestRecordDailyPnLText = dashboardStore.data
    ? dashboardStore.formatPnL(dashboardStore.latestRecordDailyPnL)
    : '--';

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
          onClick={() => dashboardStore.fetchDashboard()}
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
              onClick={() => dashboardStore.fetchDashboard()}
              type="button"
            >
              重试
            </button>
          </div>
        )}

        {(dashboardStore.data || !dashboardStore.loading) && (
          <>
            <StatsCards />
            <QuickEntry />
            <RecentRecords />
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
