import { useCallback, useRef, useState } from 'react';
import {
  listApplications,
  getApplication,
  isTerminalStatus,
  type LoanApplication,
} from '../../api';
import { usePolling, type PollingState } from '../hooks/use-polling';

export const POLL_INTERVAL_MS = Number(
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.['VITE_POLL_INTERVAL_MS']) ||
  10_000,
);

export interface ApplicationsPageState {
  readonly items: LoanApplication[] | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly hasPending: boolean;
}

export function useLoanApplications(
  filter?: { status?: string },
): ApplicationsPageState & {
  readonly polling: PollingState;
  readonly refetch: () => Promise<void>;
} {
  const [items, setItems] = useState<LoanApplication[] | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const status = filter?.status;

  const latest = useRef<{ items: LoanApplication[] | null }>({ items });
  latest.current.items = items;

  const fetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await listApplications(
        status ? { status } : undefined,
      );
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [status]);

  const tick = useCallback(async (): Promise<boolean> => {
    await fetch();
    const current = latest.current.items ?? [];
    const pending = current.some((a) => a.status === 'PENDING');
    return pending;
  }, [fetch]);

  const polling = usePolling(tick, {
    intervalMs: POLL_INTERVAL_MS,
    active: true,
  });

  const hasPending = (items ?? []).some((a) => a.status === 'PENDING');

  return {
    items,
    isLoading,
    error,
    hasPending,
    polling,
    refetch: fetch,
  };
}

export function useLoanApplication(
  id: string,
): ApplicationsPageState & {
  readonly polling: PollingState;
  readonly application: LoanApplication | null;
  readonly hasDecision: boolean;
  readonly refetch: () => Promise<void>;
} {
  const [application, setApplication] = useState<LoanApplication | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const latest = useRef<{ application: LoanApplication | null }>({
    application,
  });
  latest.current.application = application;

  const fetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApplication(id);
      setApplication(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const tick = useCallback(async (): Promise<boolean> => {
    await fetch();
    const app = latest.current.application;
    return app !== null && !isTerminalStatus(app.status);
  }, [fetch]);

  const polling = usePolling(tick, {
    intervalMs: POLL_INTERVAL_MS,
    active: true,
  });

  const hasDecision =
    !!application && isTerminalStatus(application.status);

  return {
    application,
    items: application ? [application] : null,
    isLoading,
    error,
    hasPending: !!application && application.status === 'PENDING',
    hasDecision,
    polling,
    refetch: fetch,
  };
}
