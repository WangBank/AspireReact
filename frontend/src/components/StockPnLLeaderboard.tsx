import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useStore } from '../stores/StoreProvider';
import StockLink from './StockLink';
import './StockPnLLeaderboard.css';

interface StockPnLLeaderboardProps {
  title?: string;
}

const StockPnLLeaderboard = observer(({ title = '全部盈亏榜' }: StockPnLLeaderboardProps) => {
  const { stockLeaderboardStore } = useStore();

  useEffect(() => {
    void stockLeaderboardStore.fetch(true);
  }, [stockLeaderboardStore]);

  const renderTable = (heading: string, items: typeof stockLeaderboardStore.topGainers, tone: 'gain' | 'loss') => (
    <section className="spl-panel">
      <div className="spl-panel__header">
        <h3 className="spl-panel__title">{heading}</h3>
        <span className={`spl-panel__badge spl-panel__badge--${tone}`}>Top 20</span>
      </div>
      {items.length === 0 ? (
        <div className="spl-empty">暂无数据</div>
      ) : (
        <div className="spl-table-wrap">
          <table className="spl-table">
            <thead>
              <tr>
                <th>心魔代码</th>
                <th>心魔名称</th>
                <th>板块</th>
                <th className="spl-num">累计盈亏</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${tone}-${item.stockCode}`}>
                  <td data-label="心魔代码">
                    <StockLink stockCode={item.stockCode} stockName={item.stockName} />
                  </td>
                  <td data-label="心魔名称">{item.stockName}</td>
                  <td data-label="板块">
                    <span className={`spl-board-tag spl-board-tag--${item.board}`}>{item.board}</span>
                  </td>
                  <td
                    data-label="累计盈亏"
                    className={`spl-num ${tone === 'gain' ? 'spl-positive' : 'spl-negative'}`}
                  >
                    {stockLeaderboardStore.formatMoney(item.totalCumulativePnL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <section className="spl-section">
      <div className="spl-header">
        <h2 className="section-title">{title}</h2>
        {stockLeaderboardStore.loading && <span className="spl-state">加载中...</span>}
        {stockLeaderboardStore.error && !stockLeaderboardStore.loading && (
          <span className="spl-state spl-state--error">{stockLeaderboardStore.error}</span>
        )}
      </div>
      <div className="spl-grid">
        {renderTable('盈利最多的股票', stockLeaderboardStore.topGainers, 'gain')}
        {renderTable('亏损最多的股票', stockLeaderboardStore.topLosers, 'loss')}
      </div>
    </section>
  );
});

export default StockPnLLeaderboard;
