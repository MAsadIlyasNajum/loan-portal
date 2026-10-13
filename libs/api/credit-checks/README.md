# credit-checks

Asynchronous credit check processing for loan
applications.

## How it works

- Submitting a loan application (`POST /api/loans`)
  creates the application and a durable
  `credit_check_jobs` row in a single transaction.
  The application starts as `PENDING`.
- Each job is scheduled to become due after a
  randomly selected delay between
  `CREDIT_CHECK_MIN_DELAY_MS` (10 seconds by
  default) and `CREDIT_CHECK_MAX_DELAY_MS`
  (5 minutes by default).
- `CreditCheckSchedulerService` polls the queue
  (`CREDIT_CHECK_POLL_INTERVAL_MS`, 1 second by
  default), claims due jobs with an atomic
  compare-and-swap, and processes them
  concurrently. Processing asks the
  `SimulatedCreditBureauService` for a decision
  (`APPROVED` or `REJECTED`) and applies it to
  the application with an atomic, `PENDING`-guarded
  update, then marks the job `COMPLETED`.

## Reliability guarantees

- **Durable queue**: jobs live in MySQL
  (`credit_check_jobs`), not in memory, so pending
  credit checks survive API restarts. On startup the
  scheduler runs a recovery pass.
- **Exactly one decision**: the claim
  (`UPDATE ... WHERE status = 'QUEUED'`) and the
  application transition
  (`UPDATE ... WHERE status = 'PENDING'`) are atomic
  and guarded, so concurrent workers, duplicate
  deliveries and retries can never complete the same
  application twice or overwrite a final decision.
  The unique constraint on `applicationId` prevents
  scheduling a second credit check for an application.
- **Restart recovery**: jobs left `PROCESSING` by a
  dead worker (lock older than
  `CREDIT_CHECK_STALE_JOB_MS`) are requeued; failed
  jobs are retried with a bounded budget
  (`CREDIT_CHECK_MAX_ATTEMPTS`) and, after a
  cooldown (`CREDIT_CHECK_FAILED_RETRY_MS`), get a
  fresh attempt burst so nothing is permanently
  stuck; `PENDING` applications without a job are
  adopted.
- **Customer visibility**: the decision becomes
  visible through the existing REST API
  (`GET /api/loans` and `GET /api/loans/:id`),
  which the frontend polls — no new push mechanism
  is required.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `CREDIT_CHECK_MIN_DELAY_MS` | `10000` | Minimum simulated credit check delay |
| `CREDIT_CHECK_MAX_DELAY_MS` | `300000` | Maximum simulated credit check delay |
| `CREDIT_CHECK_POLL_INTERVAL_MS` | `1000` | Scheduler poll interval |
| `CREDIT_CHECK_STALE_JOB_MS` | `120000` | When a `PROCESSING` job is considered dead |
| `CREDIT_CHECK_MAX_ATTEMPTS` | `5` | Bounded retries per attempt burst |
| `CREDIT_CHECK_RETRY_DELAY_MS` | `5000` | Backoff before retrying a failed job |
| `CREDIT_CHECK_FAILED_RETRY_MS` | `300000` | Cooldown before a `FAILED` job is retried again |
| `CREDIT_CHECK_BATCH_SIZE` | `50` | Jobs recovered/claimed per pass |
| `CREDIT_CHECK_APPROVAL_RATE` | `0.5` | Simulated bureau approval probability |

## Tests

Unit tests (fake clock, in-memory Prisma double):

```sh
nx test credit-checks
```

Integration tests against a disposable MySQL
database (skipped unless `CREDIT_CHECKS_TEST_DATABASE_URL`
is set):

```sh
libs/api/credit-checks/prisma/setup-test-database.sh
CREDIT_CHECKS_TEST_DATABASE_URL="mysql://loan_user:loan_password@localhost:3306/loan_portal_credit_checks_test?schema=public" \
  nx test credit-checks
```

The e2e credit check specs run in short-delay mode
only (a real 10s–5min delay does not belong in the
e2e suite):

```sh
CREDIT_CHECK_MIN_DELAY_MS=200 CREDIT_CHECK_MAX_DELAY_MS=600 \
  nx run api-e2e:e2e
```
