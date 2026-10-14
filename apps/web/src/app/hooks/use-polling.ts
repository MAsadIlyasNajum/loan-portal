import { useEffect, useRef, useState } from 'react';

export interface PollingState {
  readonly isTicking: boolean;
  readonly isArmed: boolean;
  readonly error: Error | null;
}

export interface PollingOptions {
  /** Interval between ticks in milliseconds. */
  readonly intervalMs: number;
  /** When false, polling does not run. */
  readonly active?: boolean;
  /** When true, the first tick runs immediately on activation. */
  readonly immediate?: boolean;
}

const DEFAULT_INTERVAL_MS = 10_000;

export function usePolling(
  /**
   * A single polling tick. Resolves with `true` to schedule the
   * next tick, or `false` to stop polling (no pending work left).
   * It must be a stable reference (e.g. wrapped in useCallback with
   * stable deps) so the effect is not restarted on every render.
   */
  tick: () => Promise<boolean>,
  options: PollingOptions,
): PollingState {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    active = true,
    immediate = true,
  } = options;

  const [isTicking, setTicking] = useState(false);
  const [isArmed, setArmed] = useState(active);
  const [error, setError] = useState<Error | null>(null);

  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setArmed(false);
      setTicking(false);
      return;
    }

    let cancelled = false;
    setArmed(true);
    setTicking(false);
    setError(null);

    const tickOnce = async () => {
      if (cancelled) return;
      // Guard against overlapping ticks: while a tick is in flight,
      // do not start another.
      setTicking(true);
      setError(null);

      try {
        const shouldContinue = await tick();
        setTicking(false);
        if (!cancelled && shouldContinue) {
          timeoutId.current = setTimeout(tickOnce, intervalMs);
        } else {
          // No pending work: disarm the loop.
          setArmed(false);
          setTicking(false);
        }
      } catch (err: unknown) {
        setTicking(false);
        setError(err instanceof Error ? err : new Error(String(err)));
        // On error, keep retrying on the configured interval.
        if (!cancelled) {
          timeoutId.current = setTimeout(tickOnce, intervalMs);
        }
      }
    };

    timeoutId.current = immediate
      ? setTimeout(tickOnce, 0)
      : setTimeout(tickOnce, intervalMs);

    return () => {
      cancelled = true;
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current = null;
      }
    };
  }, [active, intervalMs, immediate, tick]);

  return { isTicking, isArmed, error };
}
