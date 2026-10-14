import type { LoanApplication } from '../../api';

export const POLL_INTERVAL_MS = 10000;

export interface ApplicationsPageState {
  readonly items: LoanApplication[] | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly hasPending: boolean;
}

export function useLoanApplications(): ApplicationsPageState & {
  readonly polling: { isTicking: boolean; isArmed: boolean; error: Error | null };
  readonly refetch: () => Promise<void>;
} {
  return {
    items: null,
    isLoading: false,
    error: null,
    hasPending: false,
    polling: { isTicking: false, isArmed: false, error: null },
    refetch: jest.fn(),
  };
}

export function useLoanApplication(): ApplicationsPageState & {
  readonly polling: { isTicking: boolean; isArmed: boolean; error: Error | null };
  readonly application: LoanApplication | null;
  readonly hasDecision: boolean;
  readonly refetch: () => Promise<void>;
} {
  return {
    items: null,
    isLoading: false,
    error: null,
    hasPending: false,
    hasDecision: false,
    application: null,
    polling: { isTicking: false, isArmed: false, error: null },
    refetch: jest.fn(),
  };
}