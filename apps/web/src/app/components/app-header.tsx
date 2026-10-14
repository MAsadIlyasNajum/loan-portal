import type { JSX } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import type { UserRole } from '../../api';

function roleLabel(role: UserRole): string {
  return role === 'ADMIN' ? 'Admin' : 'Customer';
}

export function AppHeader(): JSX.Element {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="header">
      <nav className="nav" aria-label="Primary">
        <NavLink to="/" className="logo">
          Loan Portal
        </NavLink>
        {isAuthenticated ? (
          <span className="nav-links">
            <NavLink to="/dashboard" className="nav-link">
              My applications
            </NavLink>
            {user?.role === ('ADMIN' as UserRole) ? (
              <NavLink to="/admin" className="nav-link">
                Admin
              </NavLink>
            ) : null}
          </span>
        ) : null}
      </nav>

      <div className="header-actions">
        {isAuthenticated && user ? (
          <>
            <span
              className="muted"
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              {user.email}
              {' · '}
              <span className={`role-badge role-${user.role.toLowerCase()}`}>
                {roleLabel(user.role)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <NavLink to="/login" className="btn btn-outline btn-sm">
            Sign in
          </NavLink>
        )}
      </div>
    </header>
  );
}
