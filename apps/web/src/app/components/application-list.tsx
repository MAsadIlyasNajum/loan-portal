import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import type { LoanApplication } from '../../api';
import { StatusBadge } from './ui/status-badge';
import { formatDateTime, formatCurrency } from '../lib/format';

export interface ApplicationListProps {
  readonly applications: LoanApplication[];
  readonly isLoading?: boolean;
  readonly showApplicant?: boolean;
}

export function ApplicationList({
  applications,
  isLoading,
  showApplicant = false,
}: ApplicationListProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="center">
        <span className="spinner" aria-label="Loading applications" />
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="center">
        <p className="muted">No applications found.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            {showApplicant ? <th scope="col">Applicant</th> : null}
            <th scope="col">Submitted</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id}>
              <td>
                <code style={{ fontSize: '0.8rem' }}>{shortId(app.id)}</code>
              </td>
              {showApplicant ? (
                <td>
                  {app.fullName}
                  <br />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {app.email}
                  </span>
                </td>
              ) : null}
              <td>{formatDateTime(app.createdAt)}</td>
              <td>{formatCurrency(app.requestedAmount)}</td>
              <td>
                <StatusBadge status={app.status} />
                {app.status === 'PENDING' ? pendingHint() : null}
              </td>
              <td style={{ textAlign: 'right' }}>
                <Link
                  to={`/applications/${app.id}`}
                  className="btn btn-ghost btn-sm"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pendingHint(): JSX.Element {
  return (
    <span
      className="muted"
      style={{ fontSize: '0.75rem', marginLeft: '0.4rem' }}
    >
      (auto-updating)
    </span>
  );
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}
