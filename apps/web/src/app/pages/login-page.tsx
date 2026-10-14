import { useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/form';
import { ErrorMessage } from '../components/ui/error-boundary';
import { isValidEmail, normalizeEmail } from '../lib/validation';
import { errorMessage } from '../../api';

interface LocationState {
  from?: Location;
}

export function LoginPage(): ReactElement {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    server?: string;
  }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    const trimmed = email.trim();
    if (!trimmed) {
      next.email = 'Email is required.';
    } else if (!isValidEmail(trimmed)) {
      next.email = 'Enter a valid email address.';
    }
    if (!password) {
      next.password = 'Password is required.';
    }
    setErrors(next);
    return Object.keys(next).filter((k) => k !== 'server').length === 0;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setErrors((e) => ({ ...e, server: undefined }));
    if (!validate()) return;

    try {
      await login(normalizeEmail(email), password);
      navigate(from, { replace: true });
    } catch (error: unknown) {
      const msg = errorMessage(error);
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        setErrors({ server: 'Invalid email or password.' });
      } else if (status === 400) {
        setErrors({ server: msg });
      } else {
        setErrors({ server: msg });
      }
    }
  }

  const disabled = isLoading;

  return (
    <div className="center" style={{ maxWidth: 420, margin: '0 auto' }}>
      <div className="card" style={{ width: '100%' }}>
        <h1 style={{ marginTop: 0 }}>Log in</h1>
        <p className="muted">Sign in to your loan portal account.</p>

        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            aria-invalid={Boolean(errors.email)}
            disabled={disabled}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            aria-invalid={Boolean(errors.password)}
            disabled={disabled}
            required
          />

          {errors.server ? <ErrorMessage message={errors.server} /> : null}

          <div className="form-actions">
            <Button type="submit" isLoading={isLoading} disabled={disabled}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
        </form>

        <p className="muted" style={{ marginTop: '1rem' }}>
          No account?{' '}
          <a href="/register" style={{ color: 'var(--color-primary)' }}>
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
