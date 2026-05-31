import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import StockLink from '../components/StockLink';
import TablePagination from '../components/Table/TablePagination';
import { tradeService, type StockTradeResponse } from '../services/TradeService';
import { extractDatePart } from '../utils/date';
import { clampPage, getTotalPages, paginateItems } from '../utils/table';
import './StockHistoryPage.css';

type HistoryAction =
  | '建仓'
  | '加仓'
  | '减仓'
  | '做T'
  | '做T清仓'
  | '持仓'
  | '建仓快照'
  | '清仓'
  | '清仓快照';

interface DecoratedTradeRecord extends StockTradeResponse {
  action: HistoryAction;
  cycleNumber: number;
}

interface TradeCycleSummary {
  cycleNumber: number;
  startDate: string;
  endDate: string | null;
  isClosed: boolean;
  totalPnL: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  pnlRatio: number | null;
  recordCount: number;
  latestPositionQuantity: number;
}

const DETAIL_PAGE_SIZE = 30;

const isClosedTrade = (trade: StockTradeResponse) => trade.isLiquidated || trade.positionQuantity <= 0;

const hasBuy = (trade: StockTradeResponse) => trade.buyPrice > 0 && trade.buyQuantity > 0;

const hasSell = (trade: StockTradeResponse) => trade.sellPrice > 0 && trade.sellQuantity > 0;

const getTradeAction = (trade: StockTradeResponse, previousPositionQuantity: number): HistoryAction => {
  const closed = isClosedTrade(trade);
  const bought = hasBuy(trade);
  const sold = hasSell(trade);

  if (bought && sold) {
    return closed ? '做T清仓' : '做T';
  }

  if (bought) {
    return previousPositionQuantity <= 0 ? '建仓' : '加仓';
  }

  if (sold) {
    return closed ? '清仓' : '减仓';
  }

  if (closed) {
    return '清仓快照';
  }

  return previousPositionQuantity <= 0 ? '建仓快照' : '持仓';
};

const formatMoney = (value: number) => {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(2)}`;
};

const formatPercent = (value: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value * 100).toFixed(2)}%`;
};

const formatRatio = (value: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(2)} : 1`;
};

const buildTradeHistory = (records: StockTradeResponse[]) => {
  const ordered = [...records].sort((left, right) => {
    const dateCompare = new Date(left.tradeDate).getTime() - new Date(right.tradeDate).getTime();
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.id - right.id;
  });

  const decorated: DecoratedTradeRecord[] = [];
  const cycles: TradeCycleSummary[] = [];
  let cycleNumber = 0;
  let currentCycle: TradeCycleSummary | null = null;

  for (const [index, record] of ordered.entries()) {
    const previous = decorated[index - 1];
    const previousPositionQuantity = previous && !isClosedTrade(previous) ? previous.positionQuantity : 0;
    const action = getTradeAction(record, previousPositionQuantity);

    if (!currentCycle) {
      cycleNumber += 1;
      currentCycle = {
        cycleNumber,
        startDate: record.tradeDate,
        endDate: null,
        isClosed: false,
        totalPnL: 0,
        totalBuyAmount: 0,
        totalSellAmount: 0,
        pnlRatio: null,
        recordCount: 0,
        latestPositionQuantity: record.positionQuantity,
      };
    }

    currentCycle.totalPnL += record.dailyPnL;
    currentCycle.totalBuyAmount += record.buyPrice * record.buyQuantity;
    currentCycle.totalSellAmount += record.sellPrice * record.sellQuantity;
    currentCycle.recordCount += 1;
    currentCycle.latestPositionQuantity = record.positionQuantity;

    decorated.push({
      ...record,
      action,
      cycleNumber: currentCycle.cycleNumber,
    });

    if (isClosedTrade(record)) {
      currentCycle.isClosed = true;
      currentCycle.endDate = record.tradeDate;
      currentCycle.pnlRatio = currentCycle.totalBuyAmount > 0
        ? currentCycle.totalPnL / currentCycle.totalBuyAmount
        : null;
      cycles.push(currentCycle);
      currentCycle = null;
    }
  }

  if (currentCycle) {
    currentCycle.pnlRatio = currentCycle.totalBuyAmount > 0
      ? currentCycle.totalPnL / currentCycle.totalBuyAmount
      : null;
    cycles.push(currentCycle);
  }

  return {
    decoratedAscending: decorated,
    decoratedDescending: [...decorated].reverse(),
    cyclesDescending: [...cycles].reverse(),
  };
};

const getToneClass = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '';
  }

  return value >= 0 ? 'shp-positive' : 'shp-negative';
};

const StockHistoryPage = () => {
  const navigate = useNavigate();
  const { stockCode = '' } = useParams();
  const [searchParams] = useSearchParams();
  const initialName = searchParams.get('name')?.trim() ?? '';

  const [records, setRecords] = useState<StockTradeResponse[]>([]);
  const [stockName, setStockName] = useState(initialName);
  const [board, setBoard] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await tradeService.query({
          stockCode,
          page: 1,
          pageSize: 5000,
        });

        if (!response.success) {
          setError(response.message || '加载历史流水失败');
          setRecords([]);
          setLoading(false);
          return;
        }

        const exactRecords = (response.data || []).filter((item) => item.stockCode === stockCode);
        setRecords(exactRecords);
        setStockName(exactRecords[0]?.stockName || initialName || stockCode);
        setBoard(exactRecords[0]?.board || '');
        setPage(1);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '加载历史流水失败');
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [initialName, reloadKey, stockCode]);

  const { decoratedDescending, cyclesDescending } = buildTradeHistory(records);
  const latestRecord = records.length > 0 ? [...records].sort((left, right) => {
    const dateCompare = new Date(right.tradeDate).getTime() - new Date(left.tradeDate).getTime();
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return right.id - left.id;
  })[0] : null;

  const totalPnL = records.reduce((sum, item) => sum + item.dailyPnL, 0);
  const totalBuyAmount = records.reduce((sum, item) => sum + item.buyPrice * item.buyQuantity, 0);
  const cumulativePnLRatio = totalBuyAmount > 0 ? totalPnL / totalBuyAmount : null;
  const closedCycles = cyclesDescending.filter((cycle) => cycle.isClosed);
  const winningCycles = closedCycles.filter((cycle) => cycle.totalPnL > 0);
  const losingCycles = closedCycles.filter((cycle) => cycle.totalPnL < 0);
  const winRate = closedCycles.length > 0 ? winningCycles.length / closedCycles.length : null;
  const averageProfit = winningCycles.length > 0
    ? winningCycles.reduce((sum, cycle) => sum + cycle.totalPnL, 0) / winningCycles.length
    : null;
  const averageLoss = losingCycles.length > 0
    ? Math.abs(losingCycles.reduce((sum, cycle) => sum + cycle.totalPnL, 0) / losingCycles.length)
    : null;
  const payoffRatio = averageProfit != null && averageLoss != null && averageLoss > 0
    ? averageProfit / averageLoss
    : null;
  const currentPositionRatio = latestRecord && !isClosedTrade(latestRecord) && latestRecord.costPrice > 0 && latestRecord.positionQuantity > 0
    ? latestRecord.positionPnL / (latestRecord.costPrice * latestRecord.positionQuantity)
    : null;

  const totalPages = getTotalPages(decoratedDescending.length, DETAIL_PAGE_SIZE);
  const pagedRecords = paginateItems(decoratedDescending, page, DETAIL_PAGE_SIZE);

  useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  const summaryCards = [
    {
      label: '累计盈亏',
      value: formatMoney(totalPnL),
      sub: `${records.length} 条历史流水`,
      tone: getToneClass(totalPnL),
    },
    {
      label: '累计盈亏比',
      value: formatPercent(cumulativePnLRatio),
      sub: '累计盈亏 / 历史买入总额',
      tone: getToneClass(cumulativePnLRatio ?? 0),
    },
    {
      label: '已清仓胜率',
      value: winRate == null ? '--' : formatPercent(winRate),
      sub: `${winningCycles.length} 胜 / ${losingCycles.length} 负`,
      tone: winRate == null ? '' : getToneClass((winRate - 0.5) || 0),
    },
    {
      label: '盈亏比',
      value: formatRatio(payoffRatio),
      sub: '平均盈利周期 / 平均亏损周期',
      tone: payoffRatio == null ? '' : getToneClass(payoffRatio - 1),
    },
    {
      label: '历史周期',
      value: `${cyclesDescending.length}`,
      sub: `${closedCycles.length} 次已清仓，${cyclesDescending.length - closedCycles.length} 次进行中`,
      tone: '',
    },
    {
      label: '当前状态',
      value: latestRecord
        ? isClosedTrade(latestRecord)
          ? '已清仓'
          : `持仓 ${latestRecord.positionQuantity.toLocaleString()} 股`
        : '暂无记录',
      sub: currentPositionRatio == null ? '暂无持仓盈亏比' : `持仓盈亏比 ${formatPercent(currentPositionRatio)}`,
      tone: latestRecord && !isClosedTrade(latestRecord) ? getToneClass(latestRecord.positionPnL) : '',
    },
  ];

  return (
    <div className="shp-container">
      <header className="shp-header">
        <div>
          <h1 className="shp-title">股票历史流水</h1>
          <p className="shp-subtitle">
            {stockName || stockCode}
            {stockCode ? ` (${stockCode})` : ''}
            {board ? ` · ${board}` : ''}
          </p>
        </div>
        <div className="shp-actions">
          <button className="shp-btn shp-btn--secondary" type="button" onClick={() => navigate(-1)}>
            返回
          </button>
          <button className="shp-btn shp-btn--primary" type="button" onClick={() => setReloadKey((current) => current + 1)}>
            刷新
          </button>
        </div>
      </header>

      <section className="shp-overview">
        <div className="shp-overview__main">
          <div className="shp-overview__name-row">
            <span className="shp-overview__name">{stockName || stockCode}</span>
            {stockCode ? <StockLink stockCode={stockCode} stockName={stockName} /> : null}
          </div>
          <p className="shp-overview__text">
            这里汇总这只股票从建仓、加仓、做T、减仓到清仓的完整历史，并自动统计累计盈亏、胜率和盈亏比。
          </p>
        </div>
      </section>

      {loading ? (
        <div className="shp-status">加载中...</div>
      ) : error ? (
        <div className="shp-status shp-status--error">
          <span>{error}</span>
          <button className="shp-btn shp-btn--secondary" type="button" onClick={() => setReloadKey((current) => current + 1)}>
            重试
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="shp-empty">
          <p>这只股票还没有历史流水记录。</p>
        </div>
      ) : (
        <>
          <section className="shp-card-grid">
            {summaryCards.map((card) => (
              <article className="shp-card" key={card.label}>
                <p className="shp-card__label">{card.label}</p>
                <p className={`shp-card__value ${card.tone}`.trim()}>{card.value}</p>
                <p className="shp-card__sub">{card.sub}</p>
              </article>
            ))}
          </section>

          <section className="shp-section">
            <div className="shp-section__header">
              <h2 className="shp-section__title">建仓清仓历史</h2>
              <span className="shp-section__meta">共 {cyclesDescending.length} 个周期</span>
            </div>
            <div className="shp-table-wrap">
              <table className="shp-table">
                <thead>
                  <tr>
                    <th>周期</th>
                    <th>建仓日</th>
                    <th>清仓日</th>
                    <th>状态</th>
                    <th className="shp-num">买入总额</th>
                    <th className="shp-num">卖出总额</th>
                    <th className="shp-num">周期盈亏</th>
                    <th className="shp-num">盈亏比</th>
                    <th className="shp-num">记录数</th>
                  </tr>
                </thead>
                <tbody>
                  {cyclesDescending.map((cycle) => (
                    <tr key={`cycle-${cycle.cycleNumber}`}>
                      <td data-label="周期">#{String(cycle.cycleNumber).padStart(2, '0')}</td>
                      <td data-label="建仓日">{extractDatePart(cycle.startDate)}</td>
                      <td data-label="清仓日">{cycle.endDate ? extractDatePart(cycle.endDate) : '进行中'}</td>
                      <td data-label="状态">
                        <span className={`shp-tag ${cycle.isClosed ? 'shp-tag--closed' : 'shp-tag--open'}`}>
                          {cycle.isClosed ? '已清仓' : `持仓 ${cycle.latestPositionQuantity.toLocaleString()} 股`}
                        </span>
                      </td>
                      <td data-label="买入总额" className="shp-num">{formatMoney(cycle.totalBuyAmount)}</td>
                      <td data-label="卖出总额" className="shp-num">{formatMoney(cycle.totalSellAmount)}</td>
                      <td data-label="周期盈亏" className={`shp-num ${getToneClass(cycle.totalPnL)}`.trim()}>
                        {formatMoney(cycle.totalPnL)}
                      </td>
                      <td data-label="盈亏比" className={`shp-num ${getToneClass(cycle.pnlRatio ?? 0)}`.trim()}>
                        {formatPercent(cycle.pnlRatio)}
                      </td>
                      <td data-label="记录数" className="shp-num">{cycle.recordCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="shp-section">
            <div className="shp-section__header">
              <h2 className="shp-section__title">历史流水明细</h2>
              <span className="shp-section__meta">按最新日期倒序</span>
            </div>
            <div className="shp-table-wrap">
              <table className="shp-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>周期</th>
                    <th>动作</th>
                    <th className="shp-num">买入价</th>
                    <th className="shp-num">买入量</th>
                    <th className="shp-num">卖出价</th>
                    <th className="shp-num">卖出量</th>
                    <th className="shp-num">持仓数量</th>
                    <th className="shp-num">当日盈亏</th>
                    <th className="shp-num">累计盈亏</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((record) => (
                    <tr key={record.id}>
                      <td data-label="日期">{extractDatePart(record.tradeDate)}</td>
                      <td data-label="周期">#{String(record.cycleNumber).padStart(2, '0')}</td>
                      <td data-label="动作">
                        <span className={`shp-tag shp-tag--action-${record.action}`}>
                          {record.action}
                        </span>
                      </td>
                      <td data-label="买入价" className="shp-num">{record.buyPrice > 0 ? record.buyPrice.toFixed(3) : '-'}</td>
                      <td data-label="买入量" className="shp-num">{record.buyQuantity > 0 ? record.buyQuantity.toLocaleString() : '-'}</td>
                      <td data-label="卖出价" className="shp-num">{record.sellPrice > 0 ? record.sellPrice.toFixed(3) : '-'}</td>
                      <td data-label="卖出量" className="shp-num">{record.sellQuantity > 0 ? record.sellQuantity.toLocaleString() : '-'}</td>
                      <td data-label="持仓数量" className="shp-num">{record.positionQuantity.toLocaleString()}</td>
                      <td data-label="当日盈亏" className={`shp-num ${getToneClass(record.dailyPnL)}`.trim()}>
                        {formatMoney(record.dailyPnL)}
                      </td>
                      <td data-label="累计盈亏" className={`shp-num ${getToneClass(record.cumulativePnL)}`.trim()}>
                        {formatMoney(record.cumulativePnL)}
                      </td>
                      <td data-label="状态">
                        <span className={`shp-tag ${isClosedTrade(record) ? 'shp-tag--closed' : 'shp-tag--open'}`}>
                          {isClosedTrade(record) ? '已清仓' : '持仓中'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              totalPages={totalPages}
              totalItems={decoratedDescending.length}
              onPageChange={setPage}
            />
          </section>
        </>
      )}
    </div>
  );
};

export default StockHistoryPage;
