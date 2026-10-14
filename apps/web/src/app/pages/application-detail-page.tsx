import { useState, type JSX } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLoanApplication } from '../hooks/use-loan-applications';
import { useAsync } from '../hooks/use-async';
import { listLoanPurposes } from '../../api/loan-purposes';
import type { LoanPurpose } from '../../api';
import { StatusBadge } from '../components/ui/status-badge';
import { Spinner } from '../components/ui/spinner';
import { ErrorMessage } from '../components/ui/error-boundary';
import { Button } from '../components/ui/button';
import { formatDateTime, formatCurrency } from '../lib/format';

function findPurposeName(
  purposes: readonly LoanPurpose[],
  id: string,
): string {
  return purposes.find((p) => p.id === id)?.name ?? id;
}

export function ApplicationDetailPage(): JSX.Element | null {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const applicationId = id ?? '';

  const {
    application,
    isLoading,
    error,
    hasPending,
    polling,
    hasDecision,
    refetch,
  } = useLoanApplication(applicationId);

  const {
    data: purposes,
    isLoading: purposesLoading,
    error: purposesError,
  } = useAsync<readonly LoanPurpose[]>(() => listLoanPurposes());

  const [, setTick] = useState(0);
  const retry = () => {
    void refetch();
    setTick((n) => n + 1);
  };

  if (!applicationId) {
    return (
      <div className="center">
        <ErrorMessage message="No application reference was provided." />
      </div>
    );
  }

  if (isLoading && !application) {
    return (
      <div className="center">
        <Spinner label="Loading application…" />
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="center">
        <ErrorMessage message={error.message} />
        <Button variant="outline" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!application) {
    return null;
  }

  const purposeName =
    purposesLoading || purposesError
      ? application.purposeId
      : findPurposeName(purposes ?? [], application.purposeId);

  return (
    <section aria-labelledby="detail-title">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <h1 id="detail-title" style={{ margin: 0 }}>
          Application <code style={{ fontSize: '0.85rem' }}>{application.id}</code>
        </h1>
        <Link to="/dashboard" className="btn btn-ghost btn-sm">
          Back to list
        </Link>
      </header>

      <div className="card" style={{ marginTop: '1rem' }}>
        <dl className="grid" style={{ gridTemplateColumns: '160px 1fr' }}>
          <dt className="muted">Submitted</dt>
          <dd>{formatDateTime(application.createdAt)}</dd>
          <dt className="muted">Last updated</dt>
          <dd>{formatDateTime(application.updatedAt)}</dd>
          <dt className="muted">Requested amount</dt>
          <dd>{formatCurrency(application.requestedAmount)}</dd>
          <dt className="muted">Monthly income</dt>
          <dd>{formatCurrency(application.monthlyIncome)}</dd>
          <dt className="muted">Tenure</dt>
          <dd>{application.tenureMonths} months</dd>
          <dt className="muted">Loan purpose</dt>
          <dd>{purposeName}</dd>
          <dt className="muted">Full name</dt>
          <dd>{application.fullName}</dd>
          <dt className="muted">NRIC</dt>
          <dd>{application.nric}</dd>
          <dt className="muted">Phone</dt>
          <dd>{application.phone}</dd>
          <dt className="muted">Email</dt>
          <dd>{application.email}</dd>
          <dt className="muted">Current status</dt>
          <dd>
            <StatusBadge status={application.status} />
          </dd>
        </dl>
      </div>

      {polling.error ? (
        <ErrorMessage
          message={`Live update unavailable: ${polling.error.message}`}
        />
      ) : null}

      {hasPending ? (
        <p className="muted">
          A credit check is in progress. The decision (APPROVED or
          REJECTED) will appear here automatically once the backend
          completes the check — this can take a few seconds to a few
          minutes.
        </p>
      ) : null}

      {hasDecision ? (
        <div
          className={`alert ${
            application.status === 'APPROVED'
              ? 'alert-success'
              : application.status === 'REJECTED'
              ? 'alert-error'
              : 'alert-warning'
          }`}
        >
          Your application has been{' '}
          <strong>{application.status.toLowerCase()}</strong>.
        </div>
      ) : null}

      <div style={{ marginTop: '1rem' }}>
        <Button variant="ghost" onClick={() => void navigate(-1)}>
          Go back
        </Button>
      </div>
    </section>
  );
}
