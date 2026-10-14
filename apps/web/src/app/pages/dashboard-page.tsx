import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { useLoanApplications } from '../hooks/use-loan-applications';
import { ApplicationList } from '../components/application-list';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { ErrorMessage } from '../components/ui/error-boundary';

export function DashboardPage(): JSX.Element {
  const { items, isLoading, error, hasPending, polling, refetch } =
    useLoanApplications();

  const applications = items ?? [];

  return (
    <section aria-labelledby="dashboard-title">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h1 id="dashboard-title" style={{ margin: 0 }}>
          My loan applications
        </h1>
        <Link to="/apply" className="btn btn-primary">
          New application
        </Link>
      </header>

      {error && !isLoading ? (
        <div className="center">
          <ErrorMessage message={error.message} />
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {polling.error ? (
        <ErrorMessage
          message={`Live update temporarily unavailable: ${polling.error.message}`}
        />
      ) : null}

      {hasPending ? (
        <p className="muted" style={{ marginBottom: '0.5rem' }}>
          One or more applications are pending a decision and are updated
          automatically.
        </p>
      ) : null}

      <ApplicationList
        applications={applications}
        isLoading={isLoading && applications.length === 0}
      />

      {isLoading && applications.length > 0 ? (
        <Spinner label="Refreshing…" />
      ) : null}
    </section>
  );
}
