import { observer } from 'mobx-react-lite';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { useStore } from '../stores/StoreProvider';
import SectionJumpNav, { type SectionJumpItem } from '../components/SectionJumpNav';
import RouteLoadingFallback from '../components/Page/RouteLoadingFallback';
import PageHeader from '../components/Page/PageHeader';
import './DashboardPage.css';

const PnLCalendarExplorer = lazy(() => import('../components/PnLCalendarExplorer'));
const StockPnLLeaderboard = lazy(() => import('../components/StockPnLLeaderboard'));
const StatsCards = lazy(() => import('../components/Dashboard/StatsCards'));
const TradingSnapshot = lazy(() => import('../components/Dashboard/TradingSnapshot'));
const QuickEntry = lazy(() => import('../components/Dashboard/QuickEntry'));
const RecentRecords = lazy(() => import('../components/Dashboard/RecentRecords'));

const DashboardPage = observer(() => {
  const { dashboardStore, stockLeaderboardStore } = useStore();
  const theme = useTheme();
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

  const sectionFallback = (
    <RouteLoadingFallback
      label="模块加载中..."
      minHeight={220}
      compact
    />
  );

  return (
    <div className="dashboard-container">
      <PageHeader
        title="首页概览"
        subtitle="用一眼能看懂的方式整理最近交易状态、盈亏节奏和录入入口。"
        actions={(
          <Button
            className="dashboard-refresh-btn"
            onClick={handleRefresh}
            disabled={dashboardStore.loading}
            type="button"
            variant="contained"
            startIcon={dashboardStore.loading ? <CircularProgress size={16} color="inherit" /> : <RefreshRoundedIcon />}
            sx={{
              alignSelf: { xs: 'stretch', lg: 'flex-start' },
              minWidth: 132,
              boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.18)}`,
            }}
          >
            {dashboardStore.loading && !dashboardStore.data ? '加载中...' : '刷新数据'}
          </Button>
        )}
        stats={[
          {
            label: '最近交易日期',
            value: latestRecordDateText,
          },
          {
            label: '当日盈亏',
            value: (
              <Box
                component="span"
                className={
                  dashboardStore.data
                    ? dashboardStore.isPnLPositive(dashboardStore.latestRecordDailyPnL)
                      ? 'dashboard-insight-value--positive'
                      : 'dashboard-insight-value--negative'
                    : ''
                }
              >
                {latestRecordDailyPnLText}
              </Box>
            ),
          },
        ]}
      />

      <main className="dashboard-main">
        {dashboardStore.loading && !dashboardStore.data && (
          <Stack className="dashboard-loading" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={34} thickness={4.6} />
            <Typography className="dashboard-loading__text" variant="body2" color="text.secondary">
              加载中...
            </Typography>
          </Stack>
        )}

        {dashboardStore.error && (
          <Alert
            className="dashboard-error"
            severity="error"
            action={(
              <Button className="dashboard-error__retry" color="inherit" size="small" onClick={handleRefresh}>
                重试
              </Button>
            )}
          >
            {dashboardStore.error}
          </Alert>
        )}

        {(dashboardStore.data || !dashboardStore.loading) && (
          <>
            <SectionJumpNav
              title="首页索引"
              items={dashboardSections}
              className="dashboard-index-nav"
            />
            <section id="dashboard-overview" className="dashboard-section section-jump-anchor">
              <Suspense fallback={sectionFallback}>
                <StatsCards />
              </Suspense>
            </section>
            {dashboardStore.data && (
              <Suspense fallback={sectionFallback}>
                <TradingSnapshot
                  referenceDate={dashboardStore.latestRecordDate}
                  reloadToken={snapshotReloadToken}
                />
              </Suspense>
            )}
            {dashboardStore.data && (
              <section id="dashboard-calendar" className="dashboard-section section-jump-anchor">
                <Suspense fallback={sectionFallback}>
                  <PnLCalendarExplorer
                    title="收益日历"
                    caption="首页也支持按月、按年、按日切换，方便快速查看资金曲线节奏"
                    items={dashboardStore.data.dailyPnLHeatmap ?? []}
                    emptyText="暂无可展示的收益日历数据"
                    initialMode="year"
                    dayPageSize={15}
                  />
                </Suspense>
              </section>
            )}
            <section id="dashboard-quick-entry" className="dashboard-section section-jump-anchor">
              <Suspense fallback={sectionFallback}>
                <QuickEntry />
              </Suspense>
            </section>
            <section id="dashboard-recent-records" className="dashboard-section section-jump-anchor">
              <Suspense fallback={sectionFallback}>
                <RecentRecords />
              </Suspense>
            </section>
            <section id="dashboard-leaderboard" className="dashboard-section section-jump-anchor">
              <Suspense fallback={sectionFallback}>
                <StockPnLLeaderboard />
              </Suspense>
            </section>
          </>
        )}
      </main>
    </div>
  );
});

export default DashboardPage;
