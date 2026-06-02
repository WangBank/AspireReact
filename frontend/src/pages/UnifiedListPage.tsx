import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StockTradeResponse } from '../services/TradeService';
import { useStore } from '../stores/StoreProvider';
import type {
  UnifiedItemType,
  UnifiedListItem,
  UnifiedSortField,
  UnifiedTradeStatusFilter,
} from '../stores/UnifiedListStore';
import StockLink from '../components/StockLink';
import StockHistoryLink from '../components/StockHistoryLink';
import SortableHeader from '../components/Table/SortableHeader';
import TablePagination from '../components/Table/TablePagination';
import './UnifiedListPage.css';

const TYPE_OPTIONS: { value: 'account' | 'bankflow' | 'trade'; label: string }[] = [
  { value: 'account', label: '账户列表' },
  { value: 'bankflow', label: '流水列表' },
  { value: 'trade', label: '交易列表' },
];

const TRADE_STATUS_OPTIONS: { value: UnifiedTradeStatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'holding', label: '持仓中' },
  { value: 'liquidated', label: '已清仓' },
];

const SORT_FIELD_LABELS: Record<UnifiedSortField, string> = {
  date: '日期',
  type: '类型',
  remark: '备注',
  totalAssets: '总资产',
  positionValue: '持仓市值',
  availableFunds: '可用资金',
  dailyPnL: '当日盈亏',
  flowType: '流水类型',
  amount: '金额',
  stockCode: '股票代码',
  stockName: '股票名称',
  board: '板块',
  status: '状态',
  tradePositionValue: '持仓盈亏',
  positionQuantity: '持仓数量',
};

type OverviewTone = 'positive' | 'negative';
type OverviewAccent = 'blue' | 'red' | 'green' | 'amber';

interface OverviewCard {
  label: string;
  value: string;
  detail: string;
  tone?: OverviewTone;
  accent: OverviewAccent;
}

interface InsightChip {
  label: string;
  value: string;
  tone?: OverviewTone;
}

const getItemKey = (item: Pick<UnifiedListItem, 'type' | 'id'>) => `${item.type}-${item.id}`;

const formatMoney = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);

const formatCount = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  return `${(value * 100).toFixed(1)}%`;
};

const getTradeStatus = (item: Pick<UnifiedListItem, 'isLiquidated' | 'positionQuantity'>) => {
  if (item.isLiquidated || (item.positionQuantity ?? 0) <= 0) return '清仓';
  return '持仓';
};

const getTradeStatusClassName = (item: Pick<UnifiedListItem, 'isLiquidated' | 'positionQuantity'>) =>
  getTradeStatus(item) === '清仓' ? 'ulp-status-tag--liquidated' : 'ulp-status-tag--holding';

const getToneClassName = (tone?: OverviewTone) => {
  if (tone === 'positive') return 'ulp-positive';
  if (tone === 'negative') return 'ulp-negative';
  return '';
};

const getValueTone = (value: number | null | undefined): OverviewTone | undefined => {
  if (value == null || Number.isNaN(value) || value === 0) {
    return undefined;
  }

  return value > 0 ? 'positive' : 'negative';
};

const getDateRange = (items: UnifiedListItem[]) => {
  let start = '';
  let end = '';

  items.forEach(item => {
    if (!item.date) {
      return;
    }

    if (!start || item.date < start) {
      start = item.date;
    }

    if (!end || item.date > end) {
      end = item.date;
    }
  });

  return { start, end };
};

const formatRangeLabel = (start?: string, end?: string) => {
  if (start && end) {
    return start === end ? start : `${start} ~ ${end}`;
  }

  if (start) return `${start} 起`;
  if (end) return `截至 ${end}`;
  return '全部日期';
};

const sumBy = <T,>(items: T[], getValue: (item: T) => number | null | undefined) =>
  items.reduce((total, item) => total + (getValue(item) ?? 0), 0);

const averageBy = <T,>(items: T[], getValue: (item: T) => number | null | undefined) => {
  let total = 0;
  let count = 0;

  items.forEach(item => {
    const value = getValue(item);
    if (value == null || Number.isNaN(value)) {
      return;
    }

    total += value;
    count += 1;
  });

  return count > 0 ? total / count : null;
};

const getLatestItem = (items: UnifiedListItem[]) =>
  items.reduce<UnifiedListItem | null>((latest, item) => {
    if (!latest || item.date > latest.date) {
      return item;
    }

    return latest;
  }, null);

const getExtremeItemByDailyPnL = (items: UnifiedListItem[], mode: 'max' | 'min') =>
  items.reduce<UnifiedListItem | null>((selected, item) => {
    const value = item.dailyPnL ?? 0;
    if (!selected) {
      return item;
    }

    const selectedValue = selected.dailyPnL ?? 0;
    if (mode === 'max' ? value > selectedValue : value < selectedValue) {
      return item;
    }

    return selected;
  }, null);

const getTradeRecord = (item: UnifiedListItem) => item.raw as StockTradeResponse;

const isTTrade = (item: UnifiedListItem) => {
  const trade = getTradeRecord(item);
  return (trade.buyQuantity ?? 0) > 0 && (trade.sellQuantity ?? 0) > 0;
};

const getTradeDayPnL = (items: UnifiedListItem[]) => {
  const totals = new Map<string, number>();

  items.forEach(item => {
    totals.set(item.date, (totals.get(item.date) ?? 0) + (item.dailyPnL ?? 0));
  });

  return Array.from(totals.entries()).map(([date, value]) => ({ date, value }));
};

const UnifiedListPage = observer(() => {
  const { unifiedListStore: store } = useStore();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number } | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // 初始加载：默认加载账户列表
  useEffect(() => {
    store.setActiveType('account');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const validKeys = new Set(store.data.map(getItemKey));
    setSelectedKeys(prev => prev.filter(key => validKeys.has(key)));
  }, [store.data]);

  const displayedKeys = store.displayedData.map(getItemKey);
  const selectedItems = store.data.filter(item => selectedKeys.includes(getItemKey(item)));

  const allDisplayedSelected = displayedKeys.length > 0
    && displayedKeys.every(key => selectedKeys.includes(key));

  const resetSelectionState = () => {
    setSelectedKeys([]);
    setBatchDeleteConfirm(false);
    setDeleteConfirm(null);
  };

  const handleTypeChange = (val: 'account' | 'bankflow' | 'trade') => {
    resetSelectionState();
    store.setActiveType(val);
  };

  const handleSort = (field: UnifiedSortField) => {
    store.toggleSort(field);
  };

  const handleSearch = () => {
    resetSelectionState();
    store.setDateRange(startDate, endDate);
    store.setKeyword(keyword);
    store.fetch();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setKeyword('');
    resetSelectionState();
    store.setDateRange('', '');
    store.setKeyword('');
    store.setTradeStatusFilter('all');
    store.fetch();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await store.delete(deleteConfirm.type as UnifiedItemType, deleteConfirm.id);
    setSelectedKeys(prev => prev.filter(key => key !== `${deleteConfirm.type}-${deleteConfirm.id}`));
    setDeleteConfirm(null);
  };

  const handleToggleItem = (item: UnifiedListItem) => {
    const key = getItemKey(item);
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(existing => existing !== key) : [...prev, key]
    );
  };

  const handleToggleAllDisplayed = () => {
    if (allDisplayedSelected) {
      setSelectedKeys(prev => prev.filter(key => !displayedKeys.includes(key)));
      return;
    }

    setSelectedKeys(prev => Array.from(new Set([...prev, ...displayedKeys])));
  };

  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {
      setBatchDeleteConfirm(false);
      return;
    }

    await store.deleteMany(selectedItems.map(item => ({ type: item.type, id: item.id })));
    setSelectedKeys([]);
    setBatchDeleteConfirm(false);
    setDeleteConfirm(null);
  };

  const isTrade = store.activeType === 'trade';
  const isAccount = store.activeType === 'account';
  const isBankFlow = store.activeType === 'bankflow';
  const hasSourceData = store.data.length > 0;
  const hasFilteredData = store.totalCount > 0;
  const currentStatusLabel = TRADE_STATUS_OPTIONS.find(option => option.value === store.tradeStatusFilter)?.label ?? '全部';
  const currentRangeLabel = formatRangeLabel(store.startDate, store.endDate);
  const filteredRange = getDateRange(store.filteredData);
  const filteredRangeLabel = formatRangeLabel(filteredRange.start, filteredRange.end);
  const filteredDateCount = new Set(store.filteredData.map(item => item.date)).size;
  const latestFilteredItem = getLatestItem(store.filteredData);
  const sortFieldLabel = SORT_FIELD_LABELS[store.sortField] ?? store.sortField;
  const sortOrderLabel = store.sortOrder === 'asc' ? '升序' : '降序';

  let overviewCards: OverviewCard[] = [];
  let insightChips: InsightChip[] = [];

  if (isAccount) {
    const totalDailyPnL = sumBy(store.filteredData, item => item.dailyPnL);
    const averageAvailableFunds = averageBy(store.filteredData, item => item.availableFunds);
    const averagePositionRatio = averageBy(store.filteredData, item => {
      const totalAssets = item.totalAssets ?? 0;
      if (totalAssets <= 0) {
        return null;
      }

      return (item.positionValue ?? 0) / totalAssets;
    });
    const bestDay = getExtremeItemByDailyPnL(store.filteredData, 'max');
    const worstDay = getExtremeItemByDailyPnL(store.filteredData, 'min');

    overviewCards = [
      {
        label: '覆盖天数',
        value: `${formatCount(filteredDateCount)} 天`,
        detail: filteredRangeLabel,
        accent: 'blue',
      },
      {
        label: '最近总资产',
        value: formatMoney(latestFilteredItem?.totalAssets ?? 0),
        detail: latestFilteredItem
          ? `${latestFilteredItem.date} · 可用 ${formatMoney(latestFilteredItem.availableFunds ?? 0)}`
          : '暂无最新账户记录',
        accent: 'blue',
      },
      {
        label: '区间当日盈亏',
        value: formatMoney(totalDailyPnL),
        detail: bestDay
          ? `最强单日 ${bestDay.date} · ${formatMoney(bestDay.dailyPnL ?? 0)}`
          : '暂无当日盈亏记录',
        tone: getValueTone(totalDailyPnL),
        accent: totalDailyPnL >= 0 ? 'red' : 'green',
      },
      {
        label: '平均仓位利用率',
        value: formatPercent(averagePositionRatio),
        detail: `平均可用 ${formatMoney(averageAvailableFunds ?? 0)}`,
        accent: 'amber',
      },
    ];

    insightChips = [
      { label: '筛选范围', value: currentRangeLabel },
      bestDay ? { label: '最强单日', value: `${bestDay.date} ${formatMoney(bestDay.dailyPnL ?? 0)}`, tone: getValueTone(bestDay.dailyPnL) } : null,
      worstDay ? { label: '最弱单日', value: `${worstDay.date} ${formatMoney(worstDay.dailyPnL ?? 0)}`, tone: getValueTone(worstDay.dailyPnL) } : null,
      { label: '平均可用资金', value: formatMoney(averageAvailableFunds ?? 0) },
    ].filter((chip): chip is InsightChip => chip !== null);
  } else if (isBankFlow) {
    const inflowTotal = sumBy(store.filteredData, item => item.flowType === '转入' ? item.amount : 0);
    const outflowTotal = sumBy(store.filteredData, item => item.flowType === '转出' ? item.amount : 0);
    const netFlow = inflowTotal - outflowTotal;
    const inflowItems = store.filteredData.filter(item => item.flowType === '转入');
    const outflowItems = store.filteredData.filter(item => item.flowType === '转出');
    const largestInflow = inflowItems.reduce<UnifiedListItem | null>((selected, item) => {
      if (!selected || (item.amount ?? 0) > (selected.amount ?? 0)) {
        return item;
      }

      return selected;
    }, null);
    const largestOutflow = outflowItems.reduce<UnifiedListItem | null>((selected, item) => {
      if (!selected || (item.amount ?? 0) > (selected.amount ?? 0)) {
        return item;
      }

      return selected;
    }, null);

    overviewCards = [
      {
        label: '流水笔数',
        value: `${formatCount(store.totalCount)} 条`,
        detail: `活跃 ${formatCount(filteredDateCount)} 天`,
        accent: 'blue',
      },
      {
        label: '转入合计',
        value: formatMoney(inflowTotal),
        detail: largestInflow
          ? `最大转入 ${largestInflow.date} · ${formatMoney(largestInflow.amount ?? 0)}`
          : '暂无转入记录',
        tone: inflowTotal > 0 ? 'positive' : undefined,
        accent: 'red',
      },
      {
        label: '转出合计',
        value: formatMoney(outflowTotal),
        detail: largestOutflow
          ? `最大转出 ${largestOutflow.date} · ${formatMoney(largestOutflow.amount ?? 0)}`
          : '暂无转出记录',
        tone: outflowTotal > 0 ? 'negative' : undefined,
        accent: 'green',
      },
      {
        label: '净流入',
        value: formatMoney(netFlow),
        detail: filteredRangeLabel,
        tone: getValueTone(netFlow),
        accent: netFlow >= 0 ? 'red' : 'green',
      },
    ];

    insightChips = [
      { label: '筛选范围', value: currentRangeLabel },
      { label: '活跃日期', value: `${formatCount(filteredDateCount)} 天` },
      largestInflow ? { label: '最大转入', value: `${largestInflow.date} ${formatMoney(largestInflow.amount ?? 0)}`, tone: 'positive' } : null,
      largestOutflow ? { label: '最大转出', value: `${largestOutflow.date} ${formatMoney(largestOutflow.amount ?? 0)}`, tone: 'negative' } : null,
    ].filter((chip): chip is InsightChip => chip !== null);
  } else if (isTrade) {
    const latestTradeDate = filteredRange.end;
    const latestTradeDateItems = latestTradeDate
      ? store.filteredData.filter(item => item.date === latestTradeDate)
      : [];
    const holdingCount = latestTradeDateItems.filter(item => getTradeStatus(item) === '持仓').length;
    const liquidatedCount = store.filteredData.filter(item => getTradeStatus(item) === '清仓').length;
    const totalDailyPnL = sumBy(store.filteredData, item => item.dailyPnL);
    const totalPositionPnL = sumBy(store.filteredData, item => item.tradePositionValue);
    const tTradeCount = store.filteredData.filter(isTTrade).length;
    const uniqueStockCount = new Set(
      store.filteredData.map(item => item.stockCode || item.stockName || `${item.id}`)
    ).size;
    const tradeDayPnL = getTradeDayPnL(store.filteredData);
    const bestTradeDay = tradeDayPnL.reduce<{ date: string; value: number } | null>((selected, item) => {
      if (!selected || item.value > selected.value) {
        return item;
      }

      return selected;
    }, null);
    const worstTradeDay = tradeDayPnL.reduce<{ date: string; value: number } | null>((selected, item) => {
      if (!selected || item.value < selected.value) {
        return item;
      }

      return selected;
    }, null);

    overviewCards = [
      {
        label: '交易记录',
        value: `${formatCount(store.totalCount)} 条`,
        detail: `涉及 ${formatCount(uniqueStockCount)} 只股票`,
        accent: 'blue',
      },
      {
        label: '最新持仓 / 区间清仓',
        value: `${formatCount(holdingCount)} / ${formatCount(liquidatedCount)}`,
        detail: latestTradeDate
          ? `持仓按 ${latestTradeDate} 统计 · 当前状态筛选：${currentStatusLabel}`
          : `当前状态筛选：${currentStatusLabel}`,
        accent: 'amber',
      },
      {
        label: '区间当日盈亏',
        value: formatMoney(totalDailyPnL),
        detail: bestTradeDay
          ? `最强交易日 ${bestTradeDay.date} · ${formatMoney(bestTradeDay.value)}`
          : '暂无当日盈亏记录',
        tone: getValueTone(totalDailyPnL),
        accent: totalDailyPnL >= 0 ? 'red' : 'green',
      },
      {
        label: '持仓盈亏合计',
        value: formatMoney(totalPositionPnL),
        detail: `做T ${formatCount(tTradeCount)} 条 · 占比 ${formatPercent(store.filteredData.length ? tTradeCount / store.filteredData.length : 0)}`,
        tone: getValueTone(totalPositionPnL),
        accent: totalPositionPnL >= 0 ? 'red' : 'green',
      },
    ];

    insightChips = [
      { label: '筛选范围', value: currentRangeLabel },
      { label: '交易日期', value: `${formatCount(filteredDateCount)} 天` },
      { label: '涉及股票', value: `${formatCount(uniqueStockCount)} 只` },
      bestTradeDay ? { label: '最强交易日', value: `${bestTradeDay.date} ${formatMoney(bestTradeDay.value)}`, tone: getValueTone(bestTradeDay.value) } : null,
      worstTradeDay ? { label: '最弱交易日', value: `${worstTradeDay.date} ${formatMoney(worstTradeDay.value)}`, tone: getValueTone(worstTradeDay.value) } : null,
    ].filter((chip): chip is InsightChip => chip !== null);
  }

  const tradeGroups = isTrade
    ? store.displayedData.reduce<Array<{ date: string; items: UnifiedListItem[] }>>((groups, item) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.date === item.date) {
        lastGroup.items.push(item);
      } else {
        groups.push({ date: item.date, items: [item] });
      }
      return groups;
    }, [])
    : [];

  const renderTradeGroupSummary = (date: string) => {
    const summary = store.tradeDaySummaries[date];
    if (!summary) {
      return null;
    }

    return (
      <div className="ulp-group-summary">
        <span className="ulp-group-summary-item">
          总资产 {formatMoney(summary.totalAssets)}
        </span>
        <span className={`ulp-group-summary-item ${getToneClassName(getValueTone(summary.dailyPnL))}`.trim()}>
          当日盈亏 {formatMoney(summary.dailyPnL)}
        </span>
      </div>
    );
  };

  const renderTradeGroupMeta = (items: UnifiedListItem[]) => {
    const holdingCount = items.filter(item => getTradeStatus(item) === '持仓').length;
    const liquidatedCount = items.length - holdingCount;
    const tTradeCount = items.filter(isTTrade).length;

    return (
      <div className="ulp-group-meta">
        <span>{items.length} 条记录</span>
        <span>持仓 {holdingCount}</span>
        <span>清仓 {liquidatedCount}</span>
        {tTradeCount > 0 ? <span>做T {tTradeCount}</span> : null}
      </div>
    );
  };

  const renderStandardTableHeader = () => (
    <tr>
      <th className="ulp-select-cell">
        <input
          type="checkbox"
          checked={allDisplayedSelected}
          onChange={handleToggleAllDisplayed}
          aria-label="全选当前页"
        />
      </th>
      <SortableHeader
        field={'date' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        日期
      </SortableHeader>
      {isAccount && (
        <>
          <SortableHeader
            field={'remark' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
          >
            备注
          </SortableHeader>
          <SortableHeader
            field={'totalAssets' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            总资产
          </SortableHeader>
          <SortableHeader
            field={'positionValue' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            持仓市值
          </SortableHeader>
          <SortableHeader
            field={'availableFunds' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            可用资金
          </SortableHeader>
          <SortableHeader
            field={'dailyPnL' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            当日盈亏
          </SortableHeader>
        </>
      )}
      {isBankFlow && (
        <>
          <SortableHeader
            field={'remark' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
          >
            备注
          </SortableHeader>
          <SortableHeader
            field={'flowType' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
          >
            流水类型
          </SortableHeader>
          <SortableHeader
            field={'amount' as UnifiedSortField}
            currentField={store.sortField}
            currentOrder={store.sortOrder}
            onSort={handleSort}
            className="ulp-num"
          >
            金额
          </SortableHeader>
        </>
      )}
      <th>操作</th>
    </tr>
  );

  const renderTradeTableHeader = () => (
    <tr>
      <th className="ulp-select-cell">
        <input
          type="checkbox"
          checked={allDisplayedSelected}
          onChange={handleToggleAllDisplayed}
          aria-label="全选当前页"
        />
      </th>
      <SortableHeader
        field={'stockCode' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        代码
      </SortableHeader>
      <SortableHeader
        field={'stockName' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        名称
      </SortableHeader>
      <SortableHeader
        field={'board' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        板块
      </SortableHeader>
      <SortableHeader
        field={'status' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
      >
        状态
      </SortableHeader>
      <SortableHeader
        field={'tradePositionValue' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
        className="ulp-num"
      >
        持仓盈亏
      </SortableHeader>
      <SortableHeader
        field={'positionQuantity' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
        className="ulp-num"
      >
        持仓数量
      </SortableHeader>
      <SortableHeader
        field={'dailyPnL' as UnifiedSortField}
        currentField={store.sortField}
        currentOrder={store.sortOrder}
        onSort={handleSort}
        className="ulp-num"
      >
        当日盈亏
      </SortableHeader>
      <th>操作</th>
    </tr>
  );

  const renderActionCell = (item: UnifiedListItem) => (
    <div className="ulp-actions">
      <button
        className="ulp-btn-secondary-sm"
        onClick={() => navigate(`/entry/unified?type=${item.type}&id=${item.id}`)}
      >
        编辑
      </button>
      {deleteConfirm?.type === item.type && deleteConfirm?.id === item.id ? (
        <span className="ulp-actions-confirm">
          <button className="ulp-btn-danger-sm" onClick={handleDelete}>
            确认删除
          </button>
          <button className="ulp-btn-secondary-sm" onClick={() => setDeleteConfirm(null)}>
            取消
          </button>
        </span>
      ) : (
        <button
          className="ulp-btn-danger-sm"
          onClick={() => setDeleteConfirm({ type: item.type, id: item.id })}
        >
          删除
        </button>
      )}
    </div>
  );

  const renderStandardRow = (item: UnifiedListItem) => {
    const isAccountItem = item.type === 'account';
    const isBankFlowItem = item.type === 'bankflow';

    return (
      <tr key={`${item.type}-${item.id}`}>
        <td className="ulp-select-cell" data-label="选择">
          <input
            type="checkbox"
            checked={selectedKeys.includes(getItemKey(item))}
            onChange={() => handleToggleItem(item)}
            aria-label={`选择 ${item.type}-${item.id}`}
          />
        </td>
        <td data-label="日期">{item.date}</td>

        {isAccountItem && (
          <>
            <td data-label="备注" className="ulp-remark">{item.remark || '-'}</td>
            <td data-label="总资产" className="ulp-num">{formatMoney(item.totalAssets ?? 0)}</td>
            <td data-label="持仓市值" className="ulp-num">{formatMoney(item.positionValue ?? 0)}</td>
            <td data-label="可用资金" className="ulp-num">{formatMoney(item.availableFunds ?? 0)}</td>
            <td data-label="当日盈亏" className={`ulp-num ${getToneClassName(getValueTone(item.dailyPnL))}`.trim()}>{formatMoney(item.dailyPnL ?? 0)}</td>
          </>
        )}

        {isBankFlowItem && (
          <>
            <td data-label="备注" className="ulp-remark">{item.remark || '-'}</td>
            <td data-label="类型">
              <span className={item.flowType === '转入' ? 'ulp-in' : 'ulp-out'}>
                {item.flowType}
              </span>
            </td>
            <td
              data-label="金额"
              className={`ulp-num ${item.flowType === '转入' ? 'ulp-in' : 'ulp-out'}`}
            >
              {formatMoney(item.amount ?? 0)}
            </td>
          </>
        )}

        <td data-label="操作">
          {renderActionCell(item)}
        </td>
      </tr>
    );
  };

  const renderTradeRow = (item: UnifiedListItem) => (
    <tr key={`${item.type}-${item.id}`}>
      <td className="ulp-select-cell" data-label="选择">
        <input
          type="checkbox"
          checked={selectedKeys.includes(getItemKey(item))}
          onChange={() => handleToggleItem(item)}
          aria-label={`选择 ${item.type}-${item.id}`}
        />
      </td>
      <td data-label="代码" className="ulp-mono">
        <StockLink stockCode={item.stockCode || ''} stockName={item.stockName || ''} />
      </td>
      <td data-label="名称">
        <StockHistoryLink stockCode={item.stockCode} stockName={item.stockName} />
      </td>
      <td data-label="板块">{item.board || '-'}</td>
      <td data-label="状态">
        <span className={`ulp-status-tag ${getTradeStatusClassName(item)}`}>
          {getTradeStatus(item)}
        </span>
      </td>
      <td data-label="持仓盈亏" className={`ulp-num ${getToneClassName(getValueTone(item.tradePositionValue))}`.trim()}>
        {item.tradePositionValue != null ? formatMoney(item.tradePositionValue) : '-'}
      </td>
      <td data-label="持仓数量" className="ulp-num">{item.positionQuantity ?? '-'}</td>
      <td data-label="当日盈亏" className={`ulp-num ${getToneClassName(getValueTone(item.dailyPnL))}`.trim()}>
        {item.dailyPnL != null ? formatMoney(item.dailyPnL) : '-'}
      </td>
      <td data-label="操作">
        {renderActionCell(item)}
      </td>
    </tr>
  );

  return (
    <div className="ulp-container">
      <header className="ulp-header">
        <div className="ulp-header-copy">
          <span className="ulp-header-eyebrow">Unified Workspace</span>
          <h1 className="ulp-title">数据列表</h1>
          <p className="ulp-subtitle">把账户、银证流水和交易记录放进同一个工作台里，筛选、修正和批量处理都会更顺手。</p>
        </div>
        <div className="ulp-header-meta">
          <div className="ulp-header-meta-card">
            <span className="ulp-header-meta-label">当前视图</span>
            <strong className="ulp-header-meta-value">
              {TYPE_OPTIONS.find(t => t.value === store.activeType)?.label || '数据列表'}
            </strong>
          </div>
          <div className="ulp-header-meta-card">
            <span className="ulp-header-meta-label">匹配条数</span>
            <strong className="ulp-header-meta-value">{formatCount(store.totalCount)}</strong>
          </div>
          <div className="ulp-header-meta-card">
            <span className="ulp-header-meta-label">本页显示</span>
            <strong className="ulp-header-meta-value">{formatCount(store.displayedData.length)}</strong>
          </div>
        </div>
      </header>

      <div className="ulp-filter-bar">
        <label>数据类型</label>
        <div className="ulp-type-switch" role="radiogroup" aria-label="数据类型">
          {TYPE_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`ulp-type-option ${store.activeType === opt.value ? 'ulp-type-option--active' : ''}`}
            >
              <input
                type="radio"
                name="unified-list-type"
                checked={store.activeType === opt.value}
                onChange={() => handleTypeChange(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        <label>开始日期</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>结束日期</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        {(isAccount || isBankFlow) && (
          <>
            <label>搜索</label>
            <input
              type="text"
              placeholder="备注关键词"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="ulp-input-text"
            />
          </>
        )}
        {isTrade && (
          <>
            <label>搜索</label>
            <input
              type="text"
              placeholder="代码/名称/板块"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="ulp-input-text"
            />
          </>
        )}

        <button className="ulp-btn-primary" onClick={handleSearch} disabled={store.loading}>
          查询
        </button>
        <button className="ulp-btn-secondary" onClick={handleReset} disabled={store.loading}>
          重置
        </button>
        <button className="ulp-btn-secondary" onClick={() => store.fetch()} disabled={store.loading}>
          刷新
        </button>
      </div>

      {isTrade && (
        <div className="ulp-quick-filters">
          <span className="ulp-quick-filters__label">交易状态</span>
          <div className="ulp-chip-switch" role="radiogroup" aria-label="交易状态筛选">
            {TRADE_STATUS_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`ulp-chip-switch__item ${store.tradeStatusFilter === option.value ? 'ulp-chip-switch__item--active' : ''}`}
                onClick={() => store.setTradeStatusFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="ulp-main">
        {selectedKeys.length > 0 && (
          <div className="ulp-batch-bar">
            <span>已选择 {selectedKeys.length} 条</span>
            {batchDeleteConfirm ? (
              <div className="ulp-batch-actions">
                <button className="ulp-btn-danger-sm" onClick={handleBatchDelete} disabled={store.loading}>
                  确认删除
                </button>
                <button className="ulp-btn-secondary-sm" onClick={() => setBatchDeleteConfirm(false)} disabled={store.loading}>
                  取消
                </button>
              </div>
            ) : (
              <div className="ulp-batch-actions">
                <button className="ulp-btn-danger-sm" onClick={() => setBatchDeleteConfirm(true)}>
                  批量删除
                </button>
                <button className="ulp-btn-secondary-sm" onClick={() => setSelectedKeys([])}>
                  清空选择
                </button>
              </div>
            )}
          </div>
        )}

        {!store.loading && hasFilteredData && (
          <>
            <section className="ulp-overview-grid">
              {overviewCards.map(card => (
                <article key={card.label} className={`ulp-overview-card ulp-overview-card--${card.accent}`}>
                  <span className="ulp-overview-card__label">{card.label}</span>
                  <strong className={`ulp-overview-card__value ${getToneClassName(card.tone)}`.trim()}>
                    {card.value}
                  </strong>
                  <span className="ulp-overview-card__detail">{card.detail}</span>
                </article>
              ))}
            </section>

            <section className="ulp-toolbar-card">
              <div className="ulp-toolbar-copy">
                <span className="ulp-toolbar-label">当前视图信息</span>
                <strong className="ulp-toolbar-title">
                  共 {formatCount(store.totalCount)} 条匹配记录，按 {sortFieldLabel} {sortOrderLabel}
                </strong>
                <span className="ulp-toolbar-detail">
                  筛选结果覆盖 {formatCount(filteredDateCount)} 个交易日，实际日期范围 {filteredRangeLabel}
                </span>
              </div>
              <div className="ulp-toolbar-tags">
                <span className="ulp-toolbar-tag">日期 {currentRangeLabel}</span>
                {store.keyword ? <span className="ulp-toolbar-tag">关键词 {store.keyword}</span> : null}
                {isTrade ? <span className="ulp-toolbar-tag">状态 {currentStatusLabel}</span> : null}
                {latestFilteredItem ? <span className="ulp-toolbar-tag">最近记录 {latestFilteredItem.date}</span> : null}
                <span className="ulp-toolbar-tag">手机端支持左右滑动</span>
              </div>
            </section>

            <section className="ulp-insight-strip">
              {insightChips.map(chip => (
                <article key={`${chip.label}-${chip.value}`} className="ulp-insight-card">
                  <span className="ulp-insight-card__label">{chip.label}</span>
                  <strong className={`ulp-insight-card__value ${getToneClassName(chip.tone)}`.trim()}>
                    {chip.value}
                  </strong>
                </article>
              ))}
            </section>
          </>
        )}

        {store.loading && (
          <div className="ulp-status">
            <div className="ulp-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {store.error && (
          <div className="ulp-error">
            <span>{store.error}</span>
            <button onClick={() => { store.clearError(); store.fetch(); }}>重试</button>
          </div>
        )}

        {!store.loading && !hasSourceData && !store.error && (
          <div className="ulp-empty">
            <strong>当前还没有可展示的数据</strong>
            <span>可以先去统一录入页补一条记录，或者切换日期范围后再回来查看。</span>
          </div>
        )}

        {!store.loading && hasSourceData && !hasFilteredData && !store.error && (
          <div className="ulp-empty ulp-empty--filtered">
            <strong>当前筛选没有匹配结果</strong>
            <span>试试清空关键词、放宽日期范围，或者切换到别的列表类型。</span>
            <button className="ulp-btn-secondary" onClick={handleReset}>清空筛选</button>
          </div>
        )}

        {!store.loading && hasFilteredData && !isTrade && (
          <>
            <div className="ulp-table-wrap">
              <table className={`ulp-table ${isAccount ? 'ulp-table--account' : 'ulp-table--bankflow'}`}>
                <thead>
                  {renderStandardTableHeader()}
                </thead>
                <tbody>
                  {store.displayedData.map(renderStandardRow)}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={store.page}
              totalPages={store.totalPages}
              totalItems={store.totalCount}
              onPageChange={store.setPage}
            />
          </>
        )}

        {!store.loading && hasFilteredData && isTrade && (
          <>
            <div className="ulp-trade-groups">
              {tradeGroups.map(group => (
                <section key={group.date} className="ulp-trade-group">
                  <div className="ulp-group-header">
                    <div className="ulp-group-header-main">
                      <div className="ulp-group-date">{group.date}</div>
                      {renderTradeGroupSummary(group.date)}
                    </div>
                    {renderTradeGroupMeta(group.items)}
                  </div>
                  <div className="ulp-table-wrap">
                    <table className="ulp-table ulp-table--trade">
                      <thead>
                        {renderTradeTableHeader()}
                      </thead>
                      <tbody>
                        {group.items.map(renderTradeRow)}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
            <TablePagination
              page={store.page}
              totalPages={store.totalPages}
              totalItems={store.totalCount}
              onPageChange={store.setPage}
            />
          </>
        )}
      </main>
    </div>
  );
});

export default UnifiedListPage;
