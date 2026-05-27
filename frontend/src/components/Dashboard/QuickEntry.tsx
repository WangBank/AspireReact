import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import './QuickEntry.css';

const ENTRY_ITEMS = [
  {
    key: 'account',
    title: '账户资金',
    desc: '录入当日总资产、持仓市值、可用资金',
    link: '/account',
    color: '#3b82f6',
  },
  {
    key: 'flow',
    title: '银证流水',
    desc: '记录银证转账、转入转出流水',
    link: '/bankflow',
    color: '#8b5cf6',
  },
  {
    key: 'trade',
    title: '心魔交易',
    desc: '录入买卖记录、持仓盈亏、复盘笔记',
    link: '/trade',
    color: '#f59e0b',
  },
];

const QuickEntry = observer(() => {
  const navigate = useNavigate();

  return (
    <section className="dashboard-section">
      <h2 className="section-title">快捷录入</h2>
      <div className="quick-entry-grid">
        {ENTRY_ITEMS.map((item) => (
          <button
            key={item.key}
            className="quick-entry-card"
            onClick={() => navigate(item.link)}
            type="button"
            style={{ '--card-accent': item.color } as React.CSSProperties}
          >
            <span className="quick-entry-card__title">{item.title}</span>
            <span className="quick-entry-card__desc">{item.desc}</span>
          </button>
        ))}
      </div>
    </section>
  );
});

export default QuickEntry;
