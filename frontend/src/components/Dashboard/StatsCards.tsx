import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useStore } from '../../stores/StoreProvider';

const getToneClass = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '';
  }

  return value >= 0 ? 'stats-card__tone--positive' : 'stats-card__tone--negative';
};

const StatsCards = observer(() => {
  const { dashboardStore } = useStore();
  const theme = useTheme();

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
      <Typography className="section-title" variant="h6" gutterBottom>
        数据概览
      </Typography>
      <Box
        className="stats-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 2.25,
          mt: 1.5,
        }}
      >
        {cards.map((card) => {
          const positive = dashboardStore.isPnLPositive(card.pnl);
          return (
            <Card
              key={card.key}
              className={`stats-card ${positive ? 'stats-card--gain' : 'stats-card--loss'}`}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 4,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 5,
                  backgroundColor: positive ? '#dc2626' : '#16a34a',
                },
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', p: 2.5 }}>
                <Stack
                  className="stats-card__header"
                  direction="row"
                  sx={{ justifyContent: 'space-between', gap: 1.5 }}
                >
                  <Stack spacing={0.6}>
                    <Typography className="stats-card__label" variant="overline">
                      {card.label}
                    </Typography>
                    <Typography
                      className="stats-card__value"
                      variant="h4"
                      sx={{
                        color: positive ? '#dc2626' : '#16a34a',
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {dashboardStore.formatPnL(card.pnl)}
                    </Typography>
                  </Stack>
                  <Chip
                    className="stats-card__range"
                    label={dashboardStore.formatDateRange(card.startDate, card.endDate)}
                    size="small"
                    variant="outlined"
                    sx={{ alignSelf: 'flex-start', borderRadius: 999 }}
                  />
                </Stack>

                <PaperLikeRow label="收益率">
                  <Typography
                    className={`stats-card__return-value ${getToneClass(card.returnRate)}`.trim()}
                    variant="subtitle1"
                    sx={{ fontWeight: 800 }}
                  >
                    {dashboardStore.formatPercent(card.returnRate)}
                  </Typography>
                </PaperLikeRow>

                <Divider sx={{ borderStyle: 'dashed' }} />

                {card.benchmarks.length > 0 ? (
                  <Stack className="stats-card__benchmarks" spacing={1.1} sx={{ mt: 'auto' }}>
                    {card.benchmarks.map((item) => {
                      const relative = card.returnRate != null && item.returnRate != null
                        ? card.returnRate - item.returnRate
                        : null;

                      return (
                        <Box
                          className="stats-card__benchmark"
                          key={`${card.key}-${item.key}`}
                          sx={{
                            p: 1.4,
                            borderRadius: 3,
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            bgcolor: alpha(theme.palette.primary.main, 0.02),
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <Typography className="stats-card__benchmark-name" variant="body2" sx={{ fontWeight: 700 }}>
                              {item.name}
                            </Typography>
                            <Typography
                              className={`stats-card__benchmark-value ${getToneClass(item.returnRate)}`.trim()}
                              variant="body2"
                              sx={{ fontWeight: 800 }}
                            >
                              {dashboardStore.formatPercent(item.returnRate)}
                            </Typography>
                          </Stack>
                          <Typography
                            className={`stats-card__benchmark-gap ${getToneClass(relative)}`.trim()}
                            variant="caption"
                            sx={{ mt: 0.75, display: 'block' }}
                          >
                            {relative == null ? '差值 --' : `差值 ${dashboardStore.formatPercent(relative)}`}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box
                    className="stats-card__benchmarks stats-card__benchmarks--empty"
                    sx={{
                      mt: 'auto',
                      p: 1.6,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.text.secondary, 0.04),
                      color: 'text.secondary',
                    }}
                  >
                    暂无可对比的指数数据
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </section>
  );
});

const PaperLikeRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Box
    className="stats-card__return-row"
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.25,
      px: 1.6,
      py: 1.2,
      borderRadius: 3,
      bgcolor: alpha('#0969da', 0.04),
    }}
  >
    <Typography className="stats-card__return-label" variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
      {label}
    </Typography>
    {children}
  </Box>
);

export default StatsCards;
