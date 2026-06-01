import { useEffect, useMemo, useState } from 'react';
import StockHistoryLink from '../StockHistoryLink';
import {
  statisticsService,
  type CycleDetailItem,
  type TTradeDetailItem,
  type TradeSummaryResponse,
} from '../../services/StatisticsService';
import { extractDatePart } from '../../utils/date';
import './TradingSnapshot.css';

interface TradingSnapshotProps {
  referenceDate: string | null;
  reloadToken: number;
}

const formatMoney = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  return `${(value * 100).toFixed(2)}%`;
};

const getToneClass = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '';
  }

  return value >= 0 ? 'dashboard-snapshot__tone--positive' : 'dashboard-snapshot__tone--negative';
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDateOnly = (value: string) => {
  const [year, month, day] = extractDatePart(value).split('-').map(Number);
  return new Date(year || 0, Math.max(0, (month || 1) - 1), day || 1);
};

const TradingSnapshot = ({ referenceDate, reloadToken }: TradingSnapshotProps) => {
  const [data, setData] = useState<TradeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const range = useMemo(() => {
    if (!referenceDate) {
      return null;
    }

    const parsed = parseLocalDateOnly(referenceDate);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const monthStart = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    return {
      startDate: formatDateInput(monthStart),
      endDate: formatDateInput(parsed),
      label: `${formatDateInput(monthStart)} ~ ${formatDateInput(parsed)}`,
    };
  }, [referenceDate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!range) {
        setData(null);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const summary = await statisticsService.getSummary({
          startDate: range.startDate,
          endDate: range.endDate,
        });

        if (!active) {
          return;
        }

        setData(summary);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setData(null);
        setError(loadError instanceof Error ? loadError.message : '加载复盘快照失败');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [range, reloadToken]);

  const topCycles = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...data.cycleDetails]
      .sort((left: CycleDetailItem, right: CycleDetailItem) => {
        if (right.totalPnL !== left.totalPnL) {
          return right.totalPnL - left.totalPnL;
        }

        return extractDatePart(right.startDate).localeCompare(extractDatePart(left.startDate), 'zh-CN', { numeric: true });
      })
      .slice(0, 5);
  }, [data]);

  const topTTrades = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...data.tTradeDetails]
      .sort((left: TTradeDetailItem, right: TTradeDetailItem) => {
        if (right.dailyPnL !== left.dailyPnL) {
          return right.dailyPnL - left.dailyPnL;
        }

        return extractDatePart(right.tradeDate).localeCompare(extractDatePart(left.tradeDate), 'zh-CN', { numeric: true });
      })
      .slice(0, 5);
  }, [data]);

  const bestSellReason = data?.bySellReason[0] ?? null;
  const worstEmotionTag = data?.byEmotionTag.length
    ? [...data.byEmotionTag].sort((left, right) => left.totalPnL - right.totalPnL)[0]
    : null;
  const bestTradeTag = data?.byTradeTag[0] ?? null;

  return (
    <section id="dashboard-trading-snapshot" className="dashboard-section dashboard-snapshot section-jump-anchor">
      <div className="dashboard-snapshot__header">
        <div>
          <h2 className="section-title">最近交易月复盘快照</h2>
          <p className="dashboard-snapshot__caption">
            {range ? `按最近交易日所在月份自动汇总：${range.label}` : '暂无最近交易日期，暂时无法生成复盘快照'}
          </p>
        </div>
      </div>

      {error ? (
        <div className="dashboard-snapshot__error">
          <span>{error}</span>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="dashboard-snapshot__loading">正在生成本月周期、做T和行为快照...</div>
      ) : null}

      {!loading && !error && !data ? (
        <div className="dashboard-snapshot__empty">当前还没有足够的交易数据生成复盘快照。</div>
      ) : null}

      {data ? (
        <>
          <div className="dashboard-snapshot__metrics">
            <article className="dashboard-snapshot__metric-card">
              <span className="dashboard-snapshot__metric-label">周期数</span>
              <strong className="dashboard-snapshot__metric-value">{data.cycleAnalysis?.totalCycles ?? 0}</strong>
              <span className="dashboard-snapshot__metric-sub">已结束 {data.cycleAnalysis?.closedCycles ?? 0} 个，持仓中 {data.cycleAnalysis?.openCycles ?? 0} 个</span>
            </article>
            <article className="dashboard-snapshot__metric-card">
              <span className="dashboard-snapshot__metric-label">周期胜率</span>
              <strong className={`dashboard-snapshot__metric-value ${getToneClass((data.cycleAnalysis?.closedWinRate ?? 0) - 0.5)}`.trim()}>
                {formatPercent(data.cycleAnalysis?.closedWinRate ?? null)}
              </strong>
              <span className="dashboard-snapshot__metric-sub">只统计已清仓周期</span>
            </article>
            <article className="dashboard-snapshot__metric-card">
              <span className="dashboard-snapshot__metric-label">最大单周期</span>
              <strong className={`dashboard-snapshot__metric-value ${getToneClass(data.cycleAnalysis?.maxProfitCyclePnL ?? null)}`.trim()}>
                {formatMoney(data.cycleAnalysis?.maxProfitCyclePnL ?? 0)}
              </strong>
              <span className="dashboard-snapshot__metric-sub">最大单周期盈利</span>
            </article>
            <article className="dashboard-snapshot__metric-card">
              <span className="dashboard-snapshot__metric-label">做T次数</span>
              <strong className="dashboard-snapshot__metric-value">{data.tTradeAnalysis?.tradeCount ?? 0}</strong>
              <span className="dashboard-snapshot__metric-sub">同日有买有卖的交易数</span>
            </article>
            <article className="dashboard-snapshot__metric-card">
              <span className="dashboard-snapshot__metric-label">做T胜率</span>
              <strong className={`dashboard-snapshot__metric-value ${getToneClass((data.tTradeAnalysis?.winRate ?? 0) - 0.5)}`.trim()}>
                {formatPercent(data.tTradeAnalysis?.winRate ?? null)}
              </strong>
              <span className="dashboard-snapshot__metric-sub">赢 {data.tTradeAnalysis?.winCount ?? 0} / 亏 {data.tTradeAnalysis?.loseCount ?? 0}</span>
            </article>
            <article className="dashboard-snapshot__metric-card">
              <span className="dashboard-snapshot__metric-label">做T总盈亏</span>
              <strong className={`dashboard-snapshot__metric-value ${getToneClass(data.tTradeAnalysis?.totalPnL ?? null)}`.trim()}>
                {formatMoney(data.tTradeAnalysis?.totalPnL ?? 0)}
              </strong>
              <span className="dashboard-snapshot__metric-sub">平均 {formatMoney(data.tTradeAnalysis?.averagePnL ?? 0)}</span>
            </article>
          </div>

          <div className="dashboard-snapshot__content">
            <article className="dashboard-snapshot__panel">
              <div className="dashboard-snapshot__panel-header">
                <h3>本月最强周期</h3>
                <span>{data.cycleDetails.length} 个周期</span>
              </div>
              {topCycles.length === 0 ? (
                <p className="dashboard-snapshot__panel-empty">当前区间没有可展示的周期明细。</p>
              ) : (
                <div className="dashboard-snapshot__list">
                  {topCycles.map((item) => (
                    <div className="dashboard-snapshot__list-item" key={`${item.stockCode}-${item.startDate}-${item.endDate || 'open'}`}>
                      <div className="dashboard-snapshot__list-main">
                        <StockHistoryLink stockCode={item.stockCode} stockName={item.stockName} />
                        <span className="dashboard-snapshot__list-meta">
                          {extractDatePart(item.startDate)}
                          {item.endDate ? ` ~ ${extractDatePart(item.endDate)}` : ' ~ 持仓中'}
                        </span>
                      </div>
                      <strong className={`dashboard-snapshot__list-value ${getToneClass(item.totalPnL)}`.trim()}>
                        {formatMoney(item.totalPnL)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="dashboard-snapshot__panel">
              <div className="dashboard-snapshot__panel-header">
                <h3>本月最强做T</h3>
                <span>{data.tTradeDetails.length} 条记录</span>
              </div>
              {topTTrades.length === 0 ? (
                <p className="dashboard-snapshot__panel-empty">当前区间没有做T记录。</p>
              ) : (
                <div className="dashboard-snapshot__list">
                  {topTTrades.map((item) => (
                    <div className="dashboard-snapshot__list-item" key={`${item.tradeDate}-${item.stockCode}-${item.buyQuantity}-${item.sellQuantity}`}>
                      <div className="dashboard-snapshot__list-main">
                        <StockHistoryLink stockCode={item.stockCode} stockName={item.stockName} />
                        <span className="dashboard-snapshot__list-meta">
                          {extractDatePart(item.tradeDate)} · 买 {item.buyQuantity.toLocaleString()} / 卖 {item.sellQuantity.toLocaleString()}
                        </span>
                      </div>
                      <strong className={`dashboard-snapshot__list-value ${getToneClass(item.dailyPnL)}`.trim()}>
                        {formatMoney(item.dailyPnL)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>

          <div className="dashboard-snapshot__behavior-grid">
            <article className="dashboard-snapshot__behavior-card">
              <span className="dashboard-snapshot__behavior-label">最赚钱卖出原因</span>
              <strong className="dashboard-snapshot__behavior-title">{bestSellReason?.label || '--'}</strong>
              <span className={`dashboard-snapshot__behavior-value ${getToneClass(bestSellReason?.totalPnL ?? null)}`.trim()}>
                {bestSellReason ? `${formatMoney(bestSellReason.totalPnL)} · 胜率 ${formatPercent(bestSellReason.winRate)}` : '当前区间没有卖出原因数据'}
              </span>
            </article>
            <article className="dashboard-snapshot__behavior-card">
              <span className="dashboard-snapshot__behavior-label">最伤账户情绪</span>
              <strong className="dashboard-snapshot__behavior-title">{worstEmotionTag?.label || '--'}</strong>
              <span className={`dashboard-snapshot__behavior-value ${getToneClass(worstEmotionTag?.totalPnL ?? null)}`.trim()}>
                {worstEmotionTag ? `${formatMoney(worstEmotionTag.totalPnL)} · 胜率 ${formatPercent(worstEmotionTag.winRate)}` : '当前区间没有情绪标签数据'}
              </span>
            </article>
            <article className="dashboard-snapshot__behavior-card">
              <span className="dashboard-snapshot__behavior-label">最强交易标签</span>
              <strong className="dashboard-snapshot__behavior-title">{bestTradeTag?.label || '--'}</strong>
              <span className={`dashboard-snapshot__behavior-value ${getToneClass(bestTradeTag?.totalPnL ?? null)}`.trim()}>
                {bestTradeTag ? `${formatMoney(bestTradeTag.totalPnL)} · 胜率 ${formatPercent(bestTradeTag.winRate)}` : '当前区间没有交易标签数据'}
              </span>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default TradingSnapshot;
