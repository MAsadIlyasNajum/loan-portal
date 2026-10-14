import type { JSX } from 'react';

interface SpinnerProps {
  readonly label?: string;
  readonly className?: string;
}

export function Spinner({ label = 'Loading…', className }: SpinnerProps): JSX.Element {
  return (
    <div
      className={className ?? 'center'}
      role="status"
      aria-label={label}
    >
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="muted">{label}</span> : null}
    </div>
  );
}
