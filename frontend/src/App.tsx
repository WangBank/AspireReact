import { observer } from 'mobx-react-lite';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './stores/StoreProvider';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UnifiedEntryPage from './pages/UnifiedEntryPage';
import AccountEntryPage from './pages/AccountEntryPage';
import BankFlowEntryPage from './pages/BankFlowEntryPage';
import TradeEntryPage from './pages/TradeEntryPage';
import AccountListPage from './pages/AccountListPage';
import BankFlowListPage from './pages/BankFlowListPage';
import TradeListPage from './pages/TradeListPage';
import StatisticsPage from './pages/StatisticsPage';
import GlobalNotesPage from './pages/GlobalNotesPage';
import StockNotesPage from './pages/StockNotesPage';
import ReflectionPage from './pages/ReflectionPage';
import ConfigPage from './pages/ConfigPage';
import ProfilePage from './pages/ProfilePage';
import UnifiedListPage from './pages/UnifiedListPage';
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
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/account"
        element={
          <ProtectedRoute>
            <Layout>
              <AccountEntryPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/bankflow"
        element={
          <ProtectedRoute>
            <Layout>
              <BankFlowEntryPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/trade"
        element={
          <ProtectedRoute>
            <Layout>
              <TradeEntryPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/unified/:id?"
        element={
          <ProtectedRoute>
            <Layout>
              <UnifiedEntryPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/account"
        element={
          <ProtectedRoute>
            <Layout>
              <AccountListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/bankflow"
        element={
          <ProtectedRoute>
            <Layout>
              <BankFlowListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/trade"
        element={
          <ProtectedRoute>
            <Layout>
              <TradeListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/unified"
        element={
          <ProtectedRoute>
            <Layout>
              <UnifiedListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/statistics"
        element={
          <ProtectedRoute>
            <Layout>
              <StatisticsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes/global"
        element={
          <ProtectedRoute>
            <Layout>
              <GlobalNotesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes/stock"
        element={
          <ProtectedRoute>
            <Layout>
              <StockNotesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes/reflection"
        element={
          <ProtectedRoute>
            <Layout>
              <ReflectionPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/config"
        element={
          <ProtectedRoute>
            <Layout>
              <ConfigPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={authStore.isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
});

export default App;
