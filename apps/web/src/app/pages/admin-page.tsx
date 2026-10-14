import { useState, type JSX } from 'react';
import { useLoanApplications } from '../hooks/use-loan-applications';
import { ApplicationList } from '../components/application-list';
import { Select } from '../components/ui/form';
import { Spinner } from '../components/ui/spinner';
import { ErrorMessage } from '../components/ui/error-boundary';
import { Button } from '../components/ui/button';
import type { ApplicationStatus } from '../../api';

const STATUS_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function AdminPage(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { items, isLoading, error, hasPending, polling, refetch } =
    useLoanApplications(
      statusFilter ? { status: statusFilter as ApplicationStatus } : undefined,
    );

  const applications = items ?? [];

  return (
    <section aria-labelledby="admin-title">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <h1 id="admin-title" style={{ margin: 0 }}>
          All loan applications
        </h1>
        <Select
          label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-filter"
          style={{ minWidth: 180 }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </header>

      {polling.error ? (
        <ErrorMessage
          message={`Live update unavailable: ${polling.error.message}`}
        />
      ) : null}

      {hasPending ? (
        <p className="muted" style={{ marginBottom: '0.5rem' }}>
          There are pending applications being processed. The list updates
          automatically.
        </p>
      ) : null}

      {error && !isLoading ? (
        <div className="center">
          <ErrorMessage message={error.message} />
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      <ApplicationList
        applications={applications}
        isLoading={isLoading && applications.length === 0}
        showApplicant
      />

      {isLoading && applications.length > 0 ? (
        <Spinner label="Refreshing…" />
      ) : null}
    </section>
  );
}
