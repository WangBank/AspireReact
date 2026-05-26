import { observer } from 'mobx-react-lite';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './stores/StoreProvider';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
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
      <Route path="*" element={<Navigate to={authStore.isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
});

export default App;
