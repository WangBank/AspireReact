import { observer } from 'mobx-react-lite';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './stores/StoreProvider';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccountEntryPage from './pages/AccountEntryPage';
import BankFlowEntryPage from './pages/BankFlowEntryPage';
import TradeEntryPage from './pages/TradeEntryPage';
import AccountListPage from './pages/AccountListPage';
import BankFlowListPage from './pages/BankFlowListPage';
import TradeListPage from './pages/TradeListPage';
import StatisticsPage from './pages/StatisticsPage';
import GlobalNotesPage from './pages/GlobalNotesPage';
import StockNotesPage from './pages/StockNotesPage';
import ConfigPage from './pages/ConfigPage';
import './App.css';

const ProtectedRoute = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();
  if (!authStore.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
});

const App = observer(() => {
  const { authStore } = useStore();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authStore.isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/account"
        element={
          <ProtectedRoute>
            <AccountEntryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/bankflow"
        element={
          <ProtectedRoute>
            <BankFlowEntryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/trade"
        element={
          <ProtectedRoute>
            <TradeEntryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/account"
        element={
          <ProtectedRoute>
            <AccountListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/bankflow"
        element={
          <ProtectedRoute>
            <BankFlowListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/trade"
        element={
          <ProtectedRoute>
            <TradeListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/statistics"
        element={
          <ProtectedRoute>
            <StatisticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes/global"
        element={
          <ProtectedRoute>
            <GlobalNotesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes/stock"
        element={
          <ProtectedRoute>
            <StockNotesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/config"
        element={
          <ProtectedRoute>
            <ConfigPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={authStore.isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
});

export default App;
