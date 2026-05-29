import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './RecentRecords.css';

const RecentRecords = observer(() => {
  const { dashboardStore } = useStore();

  if (!dashboardStore.data) return null;

  const { recentTrades, recentBankFlows, latestAccount } = dashboardStore.data;

  const hasTrades = recentTrades && recentTrades.length > 0;
  const hasFlows = recentBankFlows && recentBankFlows.length > 0;
  const hasAccount = !!latestAccount;

  if (!hasTrades && !hasFlows && !hasAccount) {
    return (
      <section className="dashboard-section">
        <h2 className="section-title">最近记录</h2>
        <div className="empty-state">暂无数据，请先录入记录</div>
      </section>
    );
  }

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <section className="dashboard-section">
      <h2 className="section-title">最近记录</h2>
      <div className="recent-grid">
        {hasTrades && (
          <div className="recent-panel">
            <h3 className="recent-panel__title">最近交易</h3>
            <div className="recent-list">
              {recentTrades.slice(0, 5).map((trade) => {
                const isBuy = trade.buyPrice > 0 && trade.buyQuantity > 0;
                const isSell = trade.sellPrice > 0 && trade.sellQuantity > 0;
                const isHolding = !isBuy && !isSell && trade.positionQuantity > 0;
                const type = isHolding ? '持仓'
                  : isBuy && isSell ? '买卖'
                  : isBuy ? '买入'
                  : isSell ? '卖出'
                  : '持仓';
                return (
                  <div key={trade.id} className="recent-item">
                    <div className="recent-item__header">
                      <span className="recent-item__stock">
                        {trade.stockName}
                        <span className="recent-item__code">({trade.stockCode})</span>
                      </span>
                      <span className={`recent-item__tag recent-item__tag--${type === '买入' ? 'buy' : type === '卖出' ? 'sell' : type === '持仓' ? 'hold' : 'both'}`}>
                        {type}
                      </span>
                    </div>
                    <div className="recent-item__meta">
                      <span>{formatDate(trade.tradeDate)}</span>
                      <span className={trade.positionPnL >= 0 ? 'text-gain' : 'text-loss'}>
                        {dashboardStore.formatPnL(trade.positionPnL)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasFlows && (
          <div className="recent-panel">
            <h3 className="recent-panel__title">最近流水</h3>
            <div className="recent-list">
              {recentBankFlows.slice(0, 5).map((flow) => (
                <div key={flow.id} className="recent-item">
                  <div className="recent-item__header">
                    <span className={`recent-item__tag recent-item__tag--${flow.flowType === '转入' ? 'in' : 'out'}`}>
                      {flow.flowType}
                    </span>
                    <span className="recent-item__amount">¥{flow.amount.toFixed(2)}</span>
                  </div>
                  <div className="recent-item__meta">
                    <span>{formatDate(flow.date)}</span>
                    {flow.remark && <span className="recent-item__remark">{flow.remark}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasAccount && (
          <div className="recent-panel">
            <h3 className="recent-panel__title">最新账户</h3>
            <div className="recent-list">
              <div className="recent-item">
                <div className="recent-item__header">
                  <span className="recent-item__date">{formatDate(latestAccount.date)}</span>
                </div>
                <div className="recent-item__detail">
                  <div className="detail-row">
                    <span className="detail-row__label">总资产</span>
                    <span className="detail-row__value">¥{latestAccount.totalAssets.toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row__label">持仓市值</span>
                    <span className="detail-row__value">¥{latestAccount.positionValue.toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row__label">可用资金</span>
                    <span className="detail-row__value">¥{latestAccount.availableFunds.toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row__label">当日盈亏</span>
                    <span className={`detail-row__value ${latestAccount.dailyPnL >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {dashboardStore.formatPnL(latestAccount.dailyPnL)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

export default RecentRecords;
