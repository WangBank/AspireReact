import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/StoreProvider';

const DashboardPage = observer(() => {
  const { weatherStore } = useStore();
  const navigate = useNavigate();

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Dashboard</h1>
        <p className="app-subtitle">股票交易记录管理系统</p>
      </header>

      <main className="main-content">
        <div className="card" style={{ textAlign: 'center', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>
            Dashboard 页面 — 功能开发中...
          </p>
        </div>
      </main>

      <footer className="app-footer">
        <nav>
          <span>股票交易记录管理系统 v1.0</span>
        </nav>
      </footer>
    </div>
  );
});

export default DashboardPage;