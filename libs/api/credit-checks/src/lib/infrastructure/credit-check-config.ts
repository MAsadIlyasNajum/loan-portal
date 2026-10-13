/**
 * Configuration for the asynchronous credit check
 * queue. Every value is read from the environment
 * with a sensible default so the queue works out of
 * the box against the docker-compose MySQL instance.
 */

/** Injection tokens */
export const CREDIT_CHECK_MIN_DELAY_MS =
  'CREDIT_CHECK_MIN_DELAY_MS';
export const CREDIT_CHECK_MAX_DELAY_MS =
  'CREDIT_CHECK_MAX_DELAY_MS';
export const CREDIT_CHECK_POLL_INTERVAL_MS =
  'CREDIT_CHECK_POLL_INTERVAL_MS';
export const CREDIT_CHECK_STALE_JOB_MS =
  'CREDIT_CHECK_STALE_JOB_MS';
export const CREDIT_CHECK_MAX_ATTEMPTS =
  'CREDIT_CHECK_MAX_ATTEMPTS';
export const CREDIT_CHECK_RETRY_DELAY_MS =
  'CREDIT_CHECK_RETRY_DELAY_MS';
export const CREDIT_CHECK_FAILED_RETRY_MS =
  'CREDIT_CHECK_FAILED_RETRY_MS';
export const CREDIT_CHECK_BATCH_SIZE =
  'CREDIT_CHECK_BATCH_SIZE';
export const CREDIT_CHECK_APPROVAL_RATE =
  'CREDIT_CHECK_APPROVAL_RATE';

/**
 * Defaults:
 *
 * - the simulated credit check completes after a
 *   random delay between 10 seconds and 5 minutes;
 * - the scheduler polls for due work every second;
 * - a job whose worker died is considered stale
 *   after 2 minutes and is safely requeued;
 * - each attempt burst is bounded to 5 retries;
 *   a failed job is retried again after a 5 minute
 *   cooldown so nothing is ever permanently stuck;
 * - the simulated bureau approves half of all
 *   applications.
 */
export const DEFAULT_CREDIT_CHECK_MIN_DELAY_MS = 10_000;
export const DEFAULT_CREDIT_CHECK_MAX_DELAY_MS = 300_000;
export const DEFAULT_CREDIT_CHECK_POLL_INTERVAL_MS = 1_000;
export const DEFAULT_CREDIT_CHECK_STALE_JOB_MS = 120_000;
export const DEFAULT_CREDIT_CHECK_MAX_ATTEMPTS = 5;
export const DEFAULT_CREDIT_CHECK_RETRY_DELAY_MS = 5_000;
export const DEFAULT_CREDIT_CHECK_FAILED_RETRY_MS =
  300_000;
export const DEFAULT_CREDIT_CHECK_BATCH_SIZE = 50;
export const DEFAULT_CREDIT_CHECK_APPROVAL_RATE = 0.5;

export function toNonNegativeInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.floor(parsed)
    : fallback;
}

export function toProbability(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}
