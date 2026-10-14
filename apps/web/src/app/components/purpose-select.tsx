import { type ReactNode } from 'react';
import { useAsync } from '../hooks/use-async';
import { listLoanPurposes } from '../../api/loan-purposes';
import type { LoanPurpose } from '../../api';
import { Button } from './ui/button';
import { Select } from './ui/form';
import { Spinner } from './ui/spinner';
import { ErrorMessage } from './ui/error-boundary';

export interface PurposeSelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
  readonly disabled?: boolean;
}

export function PurposeSelect({
  value,
  onChange,
  error,
  disabled,
}: PurposeSelectProps): ReactNode {
  const { data: purposes, isLoading, error: loadError, refetch } =
    useAsync<readonly LoanPurpose[]>(() => listLoanPurposes());

  if (isLoading) {
    return (
      <div className="field">
        <label className="label" htmlFor="purpose">
          Loan purpose
        </label>
        <div className="input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Spinner label="" />
          <span className="muted">Loading purposes…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="field">
        <label className="label" htmlFor="purpose">
          Loan purpose
        </label>
        <ErrorMessage message="Could not load loan purposes." />
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!purposes || purposes.length === 0) {
    return (
      <div className="field">
        <label className="label" htmlFor="purpose">
          Loan purpose
        </label>
        <ErrorMessage message="No loan purposes are currently available." />
      </div>
    );
  }

  const activePurposes = purposes.filter((p) => p.isActive);
  if (activePurposes.length === 0) {
    return (
      <div className="field">
        <label className="label" htmlFor="purpose">
          Loan purpose
        </label>
        <ErrorMessage message="No loan purposes are currently available." />
      </div>
    );
  }

  return (
    <Select
      id="purpose"
      label="Loan purpose"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      aria-invalid={Boolean(error)}
      disabled={disabled}
      placeholder="Select a purpose"
      required
    >
      {activePurposes.map((purpose) => (
      <option key={purpose.id} value={purpose.id}>
        {purpose.name}
      </option>
      ))}
    </Select>
  );
}
