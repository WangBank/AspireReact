import { useEffect, useMemo, useState } from 'react';
import TablePagination from './Table/TablePagination';
import { extractDatePart } from '../utils/date';
import './PnLCalendarExplorer.css';

export interface PnLCalendarItem {
  date: string;
  dailyPnL: number;
  totalAssets: number | null;
  netBankFlow: number;
  capitalUtilization: number | null;
}

type CalendarViewMode = 'month' | 'year' | 'day';

interface CalendarMonthCell {
  key: string;
  type: 'empty' | 'day';
  day?: number;
  item?: PnLCalendarItem | null;
}

interface CalendarMonthView {
  key: string;
  label: string;
  totalPnL: number;
  recordDays: number;
  profitDays: number;
  lossDays: number;
  cells: CalendarMonthCell[];
}

interface CalendarYearView {
  key: string;
  label: string;
  totalPnL: number;
  recordDays: number;
  profitDays: number;
  lossDays: number;
  flatDays: number;
  bestMonthLabel: string | null;
  bestMonthPnL: number | null;
  worstMonthLabel: string | null;
  worstMonthPnL: number | null;
}

const VIEW_MODES: Array<{ key: CalendarViewMode; label: string }> = [
  { key: 'month', label: '按月' },
  { key: 'year', label: '按年' },
  { key: 'day', label: '按日' },
];

const parseDateOnly = (value: string) => {
  const [year, month, day] = extractDatePart(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

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

const getToneClass = (value: number) => (value >= 0 ? 'pnl-calendar__positive' : 'pnl-calendar__negative');

const buildMonthViews = (items: PnLCalendarItem[]): CalendarMonthView[] => {
  const monthMap = new Map<string, PnLCalendarItem[]>();

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
      const entriesByDay = new Map<number, PnLCalendarItem>();

      entries.forEach((entry) => {
        entriesByDay.set(parseDateOnly(entry.date).getDate(), entry);
      });

      const cells: CalendarMonthCell[] = [];
      for (let index = 0; index < firstWeekday; index += 1) {
        cells.push({ key: `empty-${key}-${index}`, type: 'empty' });
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push({
          key: `${key}-${day}`,
          type: 'day',
          day,
          item: entriesByDay.get(day) ?? null,
        });
      }

      return {
        key,
        label: `${year}年${String(month + 1).padStart(2, '0')}月`,
        totalPnL: entries.reduce((sum, entry) => sum + entry.dailyPnL, 0),
        recordDays: entries.length,
        profitDays: entries.filter((entry) => entry.dailyPnL > 0).length,
        lossDays: entries.filter((entry) => entry.dailyPnL < 0).length,
        cells,
      };
    });
};

const buildYearViews = (items: PnLCalendarItem[]): CalendarYearView[] => {
  const yearMap = new Map<string, PnLCalendarItem[]>();

  items.forEach((item) => {
    const year = String(parseDateOnly(item.date).getFullYear());
    const current = yearMap.get(year) ?? [];
    current.push(item);
    yearMap.set(year, current);
  });

  return Array.from(yearMap.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([year, entries]) => {
      const monthlyGroups = Array.from(entries.reduce((map, entry) => {
        const date = parseDateOnly(entry.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const current = map.get(key) ?? [];
        current.push(entry);
        map.set(key, current);
        return map;
      }, new Map<string, PnLCalendarItem[]>()).entries()).map(([key, monthEntries]) => ({
        key,
        label: `${parseInt(key.slice(5, 7), 10)}月`,
        totalPnL: monthEntries.reduce((sum, item) => sum + item.dailyPnL, 0),
      }));

      const bestMonth = monthlyGroups.length > 0
        ? [...monthlyGroups].sort((left, right) => right.totalPnL - left.totalPnL)[0]
        : null;
      const worstMonth = monthlyGroups.length > 0
        ? [...monthlyGroups].sort((left, right) => left.totalPnL - right.totalPnL)[0]
        : null;

      return {
        key: year,
        label: `${year} 年`,
        totalPnL: entries.reduce((sum, entry) => sum + entry.dailyPnL, 0),
        recordDays: entries.length,
        profitDays: entries.filter((entry) => entry.dailyPnL > 0).length,
        lossDays: entries.filter((entry) => entry.dailyPnL < 0).length,
        flatDays: entries.filter((entry) => entry.dailyPnL === 0).length,
        bestMonthLabel: bestMonth?.label ?? null,
        bestMonthPnL: bestMonth?.totalPnL ?? null,
        worstMonthLabel: worstMonth?.label ?? null,
        worstMonthPnL: worstMonth?.totalPnL ?? null,
      };
    });
};

interface PnLCalendarExplorerProps {
  title: string;
  caption: string;
  items: PnLCalendarItem[];
  emptyText?: string;
  initialMode?: CalendarViewMode;
  dayPageSize?: number;
}

const PnLCalendarExplorer = ({
  title,
  caption,
  items,
  emptyText = '暂无收益日历数据',
  initialMode = 'month',
  dayPageSize = 30,
}: PnLCalendarExplorerProps) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(initialMode);
  const [dayPage, setDayPage] = useState(1);

  const orderedItems = useMemo(
    () => [...items].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [items],
  );

  const monthViews = useMemo(() => buildMonthViews(orderedItems), [orderedItems]);
  const yearViews = useMemo(() => buildYearViews(orderedItems), [orderedItems]);
  const heatmapMaxAbs = useMemo(() => {
    const values = orderedItems.map((item) => Math.abs(item.dailyPnL));
    return Math.max(1, ...values);
  }, [orderedItems]);

  const dayTotalPages = Math.max(1, Math.ceil(orderedItems.length / dayPageSize));
  const pagedDays = useMemo(
    () => orderedItems.slice((dayPage - 1) * dayPageSize, dayPage * dayPageSize),
    [dayPage, dayPageSize, orderedItems],
  );

  useEffect(() => {
    setDayPage((current) => Math.min(Math.max(1, current), dayTotalPages));
  }, [dayTotalPages]);

  useEffect(() => {
    setDayPage(1);
  }, [viewMode, items]);

  const totalPnL = orderedItems.reduce((sum, item) => sum + item.dailyPnL, 0);
  const profitDays = orderedItems.filter((item) => item.dailyPnL > 0).length;
  const lossDays = orderedItems.filter((item) => item.dailyPnL < 0).length;

  return (
    <section className="pnl-calendar">
      <div className="pnl-calendar__header">
        <div>
          <p className="pnl-calendar__title">{title}</p>
          <p className="pnl-calendar__caption">{caption}</p>
        </div>
        <div className="pnl-calendar__controls">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              className={`pnl-calendar__tab ${viewMode === mode.key ? 'pnl-calendar__tab--active' : ''}`}
              onClick={() => setViewMode(mode.key)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {orderedItems.length === 0 ? (
        <p className="pnl-calendar__empty">{emptyText}</p>
      ) : (
        <>
          <div className="pnl-calendar__summary">
            共 {orderedItems.length} 个记录日，
            <span className={getToneClass(totalPnL)}>累计 {formatMoney(totalPnL)}</span>，
            盈利 {profitDays} 天，亏损 {lossDays} 天
          </div>

          {viewMode === 'month' && (
            <div className="pnl-calendar__months">
              {monthViews.map((month) => (
                <article className="pnl-calendar__month" key={month.key}>
                  <div className="pnl-calendar__month-header">
                    <div className="pnl-calendar__month-header-main">
                      <span className="pnl-calendar__month-title">{month.label}</span>
                      <span className="pnl-calendar__month-meta">
                        {month.recordDays} 个记录日 · 盈 {month.profitDays} / 亏 {month.lossDays}
                      </span>
                    </div>
                    <span className={getToneClass(month.totalPnL)}>{formatMoney(month.totalPnL)}</span>
                  </div>
                  <div className="pnl-calendar__weekdays">
                    {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
                      <span key={`${month.key}-${label}`}>{label}</span>
                    ))}
                  </div>
                  <div className="pnl-calendar__grid">
                    {month.cells.map((cell) => {
                      if (cell.type === 'empty') {
                        return <span key={cell.key} className="pnl-calendar__cell pnl-calendar__cell--empty" />;
                      }

                      const item = cell.item ?? null;
                      const alpha = item ? Math.min(0.92, 0.18 + Math.abs(item.dailyPnL) / heatmapMaxAbs * 0.74) : 0.08;
                      const toneClass = item
                        ? item.dailyPnL > 0
                          ? 'pnl-calendar__cell--profit'
                          : item.dailyPnL < 0
                            ? 'pnl-calendar__cell--loss'
                            : 'pnl-calendar__cell--flat'
                        : 'pnl-calendar__cell--blank';

                      return (
                        <span
                          key={cell.key}
                          className={`pnl-calendar__cell ${toneClass}`}
                          style={{ ['--heatmap-alpha' as string]: alpha.toFixed(2) }}
                          title={item ? `${extractDatePart(item.date)} ${formatMoney(item.dailyPnL)}` : `${month.label} ${cell.day}日无记录`}
                        >
                          {cell.day}
                        </span>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}

          {viewMode === 'year' && (
            <div className="pnl-calendar__years">
              {yearViews.map((year) => (
                <article className="pnl-calendar__year-card" key={year.key}>
                  <p className="pnl-calendar__year">{year.label}</p>
                  <p className={`pnl-calendar__year-pnl ${getToneClass(year.totalPnL)}`.trim()}>
                    {formatMoney(year.totalPnL)}
                  </p>
                  <div className="pnl-calendar__year-grid">
                    <div className="pnl-calendar__year-item">
                      <span className="pnl-calendar__year-label">记录日</span>
                      <span className="pnl-calendar__year-value">{year.recordDays} 天</span>
                    </div>
                    <div className="pnl-calendar__year-item">
                      <span className="pnl-calendar__year-label">盈 / 亏 / 平</span>
                      <span className="pnl-calendar__year-value">{year.profitDays} / {year.lossDays} / {year.flatDays}</span>
                    </div>
                    <div className="pnl-calendar__year-item">
                      <span className="pnl-calendar__year-label">最好月份</span>
                      <span className={`pnl-calendar__year-value ${year.bestMonthPnL != null ? getToneClass(year.bestMonthPnL) : ''}`.trim()}>
                        {year.bestMonthLabel ? `${year.bestMonthLabel} ${formatMoney(year.bestMonthPnL ?? 0)}` : '--'}
                      </span>
                    </div>
                    <div className="pnl-calendar__year-item">
                      <span className="pnl-calendar__year-label">最差月份</span>
                      <span className={`pnl-calendar__year-value ${year.worstMonthPnL != null ? getToneClass(year.worstMonthPnL) : ''}`.trim()}>
                        {year.worstMonthLabel ? `${year.worstMonthLabel} ${formatMoney(year.worstMonthPnL ?? 0)}` : '--'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {viewMode === 'day' && (
            <>
              <div className="pnl-calendar__days">
                {pagedDays.map((item) => (
                  <article className="pnl-calendar__day-card" key={item.date}>
                    <div className="pnl-calendar__day-main">
                      <span className="pnl-calendar__day-date">{extractDatePart(item.date)}</span>
                      <span className="pnl-calendar__day-sub">
                        {item.dailyPnL > 0 ? '盈利日' : item.dailyPnL < 0 ? '亏损日' : '平盘日'}
                      </span>
                    </div>
                    <div className="pnl-calendar__day-metric">
                      <span className="pnl-calendar__day-label">当日盈亏</span>
                      <span className={`pnl-calendar__day-value ${getToneClass(item.dailyPnL)}`.trim()}>
                        {formatMoney(item.dailyPnL)}
                      </span>
                    </div>
                    <div className="pnl-calendar__day-metric">
                      <span className="pnl-calendar__day-label">总资产</span>
                      <span className="pnl-calendar__day-value">
                        {item.totalAssets == null ? '--' : formatMoney(item.totalAssets)}
                      </span>
                    </div>
                    <div className="pnl-calendar__day-metric">
                      <span className="pnl-calendar__day-label">净银证转账 / 资金使用率</span>
                      <span className="pnl-calendar__day-value">
                        {formatMoney(item.netBankFlow)} / {formatPercent(item.capitalUtilization)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
              <TablePagination
                page={dayPage}
                totalPages={dayTotalPages}
                totalItems={orderedItems.length}
                onPageChange={setDayPage}
                infoText={`共 ${orderedItems.length} 个交易日，第 ${dayPage}/${dayTotalPages} 页`}
              />
            </>
          )}
        </>
      )}
    </section>
  );
};

export default PnLCalendarExplorer;
