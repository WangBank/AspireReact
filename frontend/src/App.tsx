import { observer } from 'mobx-react-lite';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './stores/StoreProvider';
import GlobalLoadingMask from './components/GlobalLoadingMask';
import Layout from './components/Layout';
import RouteLoadingFallback from './components/Page/RouteLoadingFallback';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UnifiedEntryPage = lazy(() => import('./pages/UnifiedEntryPage'));
const AccountEntryPage = lazy(() => import('./pages/AccountEntryPage'));
const BankFlowEntryPage = lazy(() => import('./pages/BankFlowEntryPage'));
const TradeEntryPage = lazy(() => import('./pages/TradeEntryPage'));
const AccountListPage = lazy(() => import('./pages/AccountListPage'));
const BankFlowListPage = lazy(() => import('./pages/BankFlowListPage'));
const TradeListPage = lazy(() => import('./pages/TradeListPage'));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'));
const GlobalNotesPage = lazy(() => import('./pages/GlobalNotesPage'));
const StockNotesPage = lazy(() => import('./pages/StockNotesPage'));
const ReflectionPage = lazy(() => import('./pages/ReflectionPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const UnifiedListPage = lazy(() => import('./pages/UnifiedListPage'));
const StockHistoryPage = lazy(() => import('./pages/StockHistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MessagePage = lazy(() => import('./pages/MessagePage'));
const MessageContactsPage = lazy(() => import('./pages/MessageContactsPage'));

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

const renderLazyPage = (page: ReactNode, withLayout = true) => {
  const content = (
    <Suspense fallback={<RouteLoadingFallback />}>
      {page}
    </Suspense>
  );

  if (!withLayout) {
    return content;
  }

  return <Layout>{content}</Layout>;
};

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
              : renderLazyPage(<LoginPage />, false)
          }
        />
        <Route
          path="/dashboard"
          element={
            <UserRoute>
              {renderLazyPage(<DashboardPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/entry/account"
          element={
            <UserRoute>
              {renderLazyPage(<AccountEntryPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/entry/bankflow"
          element={
            <UserRoute>
              {renderLazyPage(<BankFlowEntryPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/entry/trade"
          element={
            <UserRoute>
              {renderLazyPage(<TradeEntryPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/entry/unified/:id?"
          element={
            <UserRoute>
              {renderLazyPage(<UnifiedEntryPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/list/account"
          element={
            <UserRoute>
              {renderLazyPage(<AccountListPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/list/bankflow"
          element={
            <UserRoute>
              {renderLazyPage(<BankFlowListPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/list/trade"
          element={
            <UserRoute>
              {renderLazyPage(<TradeListPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/list/unified"
          element={
            <UserRoute>
              {renderLazyPage(<UnifiedListPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <UserRoute>
              {renderLazyPage(<StatisticsPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              {renderLazyPage(<AdminPage />)}
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
              {renderLazyPage(<GlobalNotesPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/notes/stock"
          element={
            <UserRoute>
              {renderLazyPage(<StockNotesPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/notes/reflection"
          element={
            <UserRoute>
              {renderLazyPage(<ReflectionPage />)}
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
              {renderLazyPage(<ProfilePage />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <UserRoute>
              {renderLazyPage(<MessagePage />)}
            </UserRoute>
          }
        />
        <Route
          path="/messages/contacts"
          element={
            <UserRoute>
              {renderLazyPage(<MessageContactsPage />)}
            </UserRoute>
          }
        />
        <Route
          path="/stocks/:stockCode/history"
          element={
            <UserRoute>
              {renderLazyPage(<StockHistoryPage />)}
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
