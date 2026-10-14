import { useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/form';
import { ErrorMessage } from '../components/ui/error-boundary';
import { isValidEmail, normalizeEmail } from '../lib/validation';
import { errorMessage } from '../../api';

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)/;

export function RegisterPage(): ReactElement {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    } else if (password.length > 128) {
      next.password = 'Password must be at most 128 characters.';
    } else if (!PASSWORD_REGEX.test(password)) {
      next.password =
        'Password must contain at least one letter and one digit.';
    } else if (password !== confirm) {
      next.password = 'Passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setErrors((e) => ({ ...e, server: undefined }));
    if (!validate()) return;

    try {
      await register(normalizeEmail(email), password);
      navigate('/login', {
        replace: true,
        state: { registered: true },
      });
    } catch (error: unknown) {
      const msg = errorMessage(error);
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        setErrors({ server: 'A user with this email already exists.' });
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
        <h1 style={{ marginTop: 0 }}>Create account</h1>
        <p className="muted">Register for a new loan portal account.</p>

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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            aria-invalid={Boolean(errors.password)}
            disabled={disabled}
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-type your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={disabled}
            required
          />

          {errors.server ? <ErrorMessage message={errors.server} /> : null}

          <div className="form-actions">
            <Button type="submit" isLoading={isLoading} disabled={disabled}>
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>
          </div>
        </form>

        <p className="muted" style={{ marginTop: '1rem' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--color-primary)' }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
