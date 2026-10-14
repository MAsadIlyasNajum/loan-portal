import type { JSX } from 'react';
import type { ApplicationStatus } from '../../../api';

export interface StatusBadgeProps {
  readonly status: ApplicationStatus;
  readonly className?: string;
}

const LABEL: Record<ApplicationStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({
  status,
  className,
}: StatusBadgeProps): JSX.Element {
  const dotClass = `status-dot status-${status}`;
  return (
    <span className={`status-badge ${dotClass} ${className ?? ''}`.trim()}>
      <Dot status={status} />
      {LABEL[status]}
    </span>
  );
}

function Dot({ status }: { status: ApplicationStatus }): JSX.Element {
  const colors: Record<ApplicationStatus, string> = {
    PENDING: '#2563eb',
    APPROVED: '#059669',
    REJECTED: '#dc2626',
    CANCELLED: '#6b7280',
  };
  const color = colors[status];
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      aria-hidden="true"
      fill="none"
    >
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  PENDING: '#2563eb',
  APPROVED: '#059669',
  REJECTED: '#dc2626',
  CANCELLED: '#6b7280',
};
