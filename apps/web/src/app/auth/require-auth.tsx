import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import type { ReactElement } from 'react';
import type { AuthenticatedUser } from '../../api';

interface RequireAuthProps {
  readonly children: ReactElement;
  readonly roles?: readonly AuthenticatedUser['role'][];
}

export function RequireAuth({ children, roles }: RequireAuthProps): ReactElement {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !Array.from(roles).includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
