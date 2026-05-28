import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import './QuickEntry.css';

const QuickEntry = observer(() => {
  const navigate = useNavigate();

  return (
    <section className="dashboard-section">
      <h2 className="section-title">快捷录入</h2>
      <div className="quick-entry-grid">
        <button
          className="quick-entry-card"
          onClick={() => navigate('/entry/unified')}
          type="button"
          style={{ '--card-accent': '#6366f1' } as React.CSSProperties}
        >
          <span className="quick-entry-card__title">统一录入</span>
          <span className="quick-entry-card__desc">一次性录入账户资金、银证流水、多股票持仓</span>
        </button>
      </div>
    </section>
  );
});

export default QuickEntry;
