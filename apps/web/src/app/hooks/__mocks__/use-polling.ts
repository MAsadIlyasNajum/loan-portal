export function usePolling(): {
  isTicking: boolean;
  isArmed: boolean;
  error: Error | null;
} {
  return { isTicking: false, isArmed: false, error: null };
}