import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/auth-context';
import { RequireAuth } from './auth/require-auth';
import { AppHeader } from './components/app-header';
import { LoginPage } from './pages/login-page';
import { RegisterPage } from './pages/register-page';
import { DashboardPage } from './pages/dashboard-page';
import { CreateApplicationPage } from './pages/create-application-page';
import { ApplicationDetailPage } from './pages/application-detail-page';
import { AdminPage } from './pages/admin-page';
import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="main">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/apply"
            element={
              <RequireAuth>
                <CreateApplicationPage />
              </RequireAuth>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <RequireAuth>
                <ApplicationDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['ADMIN']}>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function RootRedirect(): ReactElement {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const from = location.state
    ? (location.state as { from?: { pathname?: string } }).from?.pathname
    : undefined;
  return (
    <Navigate
      to={isAuthenticated ? '/dashboard' : '/login'}
      replace
      state={from ? { from } : undefined}
    />
  );
}
