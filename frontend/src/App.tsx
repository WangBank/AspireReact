import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './stores/StoreProvider';
import GlobalLoadingMask from './components/GlobalLoadingMask';
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
import ProfilePage from './pages/ProfilePage';
import UnifiedListPage from './pages/UnifiedListPage';
import StockHistoryPage from './pages/StockHistoryPage';
import AdminPage from './pages/AdminPage';
import './App.css';

const ProtectedRoute = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();
  if (!authStore.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
});

const UserRoute = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();

  if (!authStore.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (authStore.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
});

const AdminRoute = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();

  if (!authStore.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!authStore.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
});

const App = observer(() => {
  const { authStore } = useStore();

  useEffect(() => {
    if (authStore.isAuthenticated && !authStore.profile && !authStore.loading) {
      void authStore.fetchProfile();
    }
  }, [authStore, authStore.isAuthenticated, authStore.loading, authStore.profile]);

  return (
    <>
      <GlobalLoadingMask />
      <Routes>
        <Route
          path="/login"
          element={
            authStore.isAuthenticated
              ? <Navigate to={authStore.isAdmin ? '/admin' : '/dashboard'} replace />
              : <LoginPage />
          }
        />
        <Route
          path="/dashboard"
          element={
            <UserRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/entry/account"
          element={
            <UserRoute>
              <Layout>
                <AccountEntryPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/entry/bankflow"
          element={
            <UserRoute>
              <Layout>
                <BankFlowEntryPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/entry/trade"
          element={
            <UserRoute>
              <Layout>
                <TradeEntryPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/entry/unified/:id?"
          element={
            <UserRoute>
              <Layout>
                <UnifiedEntryPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/list/account"
          element={
            <UserRoute>
              <Layout>
                <AccountListPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/list/bankflow"
          element={
            <UserRoute>
              <Layout>
                <BankFlowListPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/list/trade"
          element={
            <UserRoute>
              <Layout>
                <TradeListPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/list/unified"
          element={
            <UserRoute>
              <Layout>
                <UnifiedListPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <UserRoute>
              <Layout>
                <StatisticsPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Layout>
                <AdminPage />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/health"
          element={
            <ProtectedRoute>
              <Navigate to={authStore.isAdmin ? '/admin' : '/dashboard'} replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes/global"
          element={
            <UserRoute>
              <Layout>
                <GlobalNotesPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/notes/stock"
          element={
            <UserRoute>
              <Layout>
                <StockNotesPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/notes/reflection"
          element={
            <UserRoute>
              <Layout>
                <ReflectionPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/config"
          element={
            authStore.isAdmin
              ? <Navigate to="/admin?tab=settings" replace />
              : <Navigate to="/dashboard" replace />
          }
        />
        <Route
          path="/audits/imports"
          element={
            authStore.isAdmin
              ? <Navigate to="/admin?tab=audits" replace />
              : <Navigate to="/dashboard" replace />
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
        <Route
          path="/stocks/:stockCode/history"
          element={
            <UserRoute>
              <Layout>
                <StockHistoryPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="*"
          element={
            <Navigate to={authStore.isAuthenticated ? (authStore.isAdmin ? '/admin' : '/dashboard') : '/login'} replace />
          }
        />
      </Routes>
    </>
  );
});

export default App;
