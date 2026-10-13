import { execSync } from 'node:child_process';
import { join } from 'node:path';
import {
  ApplicationStatus,
  CreditCheckJobStatus,
} from '@prisma/client';
import { PrismaService } from '@org/database';
import { CreditChecksService } from './credit-checks.service';
import { SimulatedCreditBureauService } from '../infrastructure/simulated-credit-bureau.service';

/**
 * Real-MySQL integration tests for the credit
 * check queue.
 *
 * These tests run only when CREDIT_CHECKS_TEST_DATABASE_URL
 * points at a disposable MySQL database (they are skipped
 * otherwise, so the unit-test target stays green on
 * machines without MySQL):
 *
 *   libs/api/credit-checks/prisma/setup-test-database.sh
 *   CREDIT_CHECKS_TEST_DATABASE_URL="mysql://loan_user:loan_password@localhost:3306/loan_portal_credit_checks_test?schema=public" \
 *     nx test credit-checks
 *
 * The setup script (idempotent, non-destructive) creates the
 * disposable database, grants the application user access and
 * applies pending migrations with `prisma migrate deploy` —
 * forward migrations only, no resets, no destructive commands.
 *
 * The short configured delays (milliseconds instead of the
 * default 10s–5min) keep the suite fast; the delay bounds
 * themselves are covered by the unit tests.
 */
const TEST_DATABASE_URL =
  process.env['CREDIT_CHECKS_TEST_DATABASE_URL'];
const describeWithMySql = TEST_DATABASE_URL
  ? describe
  : describe.skip;

if (!TEST_DATABASE_URL) {
  console.log(
    'MySQL integration tests skipped: run libs/api/credit-checks/prisma/setup-test-database.sh and set CREDIT_CHECKS_TEST_DATABASE_URL to run them against a disposable MySQL database.',
  );
}

const WORKER_A = 'worker-a';
const WORKER_B = 'worker-b';

// Per-run unique prefix: the disposable database is
// left in place between runs, so identifiers must not
// collide with rows from a previous run.
const RUN_ID = `${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 6)}`;

describeWithMySql('CreditChecksService (MySQL integration)', () => {
  let prisma: PrismaService;
  let service: CreditChecksService;
  let bureau: SimulatedCreditBureauService;
  let originalDatabaseUrl: string | undefined;
  // Module-level sequence: unique across tests even
  // when they run within the same millisecond.
  let sequence = 0;

  beforeAll(() => {
    originalDatabaseUrl = process.env['DATABASE_URL'];

    try {
      execSync(
        'pnpm exec prisma migrate deploy --config prisma/config.ts --schema=prisma/schema.prisma',
        {
          cwd: join(__dirname, '../../../..', 'database'),
          env: {
            ...process.env,
            DATABASE_URL: TEST_DATABASE_URL,
          },
          stdio: 'pipe',
        },
      );
    } catch (error) {
      throw new Error(
        'Could not prepare the disposable MySQL test database. ' +
          'Run libs/api/credit-checks/prisma/setup-test-database.sh first, ' +
          'then re-run with CREDIT_CHECKS_TEST_DATABASE_URL set. ' +
          `Underlying error: ${(error as Error).message}`,
      );
    }

    process.env['DATABASE_URL'] = TEST_DATABASE_URL;
    prisma = new PrismaService();
    return prisma
      .$connect()
      .then(() => {
        process.env['DATABASE_URL'] = originalDatabaseUrl;
        bureau = new SimulatedCreditBureauService(1);
        service = new CreditChecksService(
          prisma,
          bureau,
          10,
          20,
          60_000,
          3,
          10,
          5_000,
          50,
        );
      })
      .catch((error: Error) => {
        process.env['DATABASE_URL'] = originalDatabaseUrl;
        throw error;
      });
  });

  afterAll(async () => {
    if (prisma) {
      // Cleanup: remove rows created by these tests. The
      // disposable database itself is left in place.
      await prisma.creditCheckJob.deleteMany().catch(() => undefined);
      await prisma.loanApplication.deleteMany().catch(() => undefined);
      await prisma.loanPurpose.deleteMany().catch(() => undefined);
      await prisma.user.deleteMany().catch(() => undefined);
      await prisma.$disconnect();
    }
    if (originalDatabaseUrl !== undefined) {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
  });

  beforeEach(async () => {
    await prisma.creditCheckJob.deleteMany();
    await prisma.loanApplication.deleteMany();
  });

  async function createApplication(): Promise<string> {
    sequence += 1;
    // Capture the sequence before the first
    // await: concurrent callers share the
    // mutable counter, so it must not be read
    // again once asynchronous.
    const seq = sequence;
    const user = await prisma.user.create({
      data: {
        email: `credit-check-${RUN_ID}-${seq}@example.com`,
        passwordHash: 'x',
      },
    });
    const purpose = await prisma.loanPurpose.create({
      data: {
        code: `PURPOSE_${RUN_ID}_${seq}`,
        name: 'Purpose',
      },
    });
    const application = await prisma.loanApplication.create({
      data: {
        fullName: 'Test Applicant',
        nric: `90010114${String(seq).padStart(4, '0')}${
          seq % 10
        }`,
        phone: '0123456789',
        email: `applicant-${RUN_ID}-${seq}@example.com`,
        monthlyIncome: 5000,
        requestedAmount: 20000,
        tenureMonths: 24,
        purposeId: purpose.id,
        userId: user.id,
        status: ApplicationStatus.PENDING,
      },
    });
    return application.id;
  }

  it('runs the full flow: schedule, claim, decide, complete', async () => {
    const applicationId = await createApplication();

    const job = await service.scheduleCreditCheck(applicationId);
    expect(job.status).toBe(CreditCheckJobStatus.QUEUED);

    const claimed = await service.claimDueJobs(
      WORKER_A,
      new Date(Date.now() + 1_000),
    );
    expect(claimed.map((job) => job.id)).toEqual([job.id]);

    const result = await service.completeJob(job.id, WORKER_A);
    expect(result).toEqual({
      status: 'completed',
      decision: ApplicationStatus.APPROVED,
      applicationTransitioned: true,
    });

    const application = await prisma.loanApplication.findUnique({
      where: { id: applicationId },
    });
    expect(application?.status).toBe(ApplicationStatus.APPROVED);

    const completedJob = await prisma.creditCheckJob.findUnique({
      where: { id: job.id },
    });
    expect(completedJob?.status).toBe(CreditCheckJobStatus.COMPLETED);
    expect(completedJob?.outcome).toBe(ApplicationStatus.APPROVED);
  });

  it('schedules the check with a delay within the configured bounds', async () => {
    const applicationId = await createApplication();

    const before = Date.now();
    const job = await service.scheduleCreditCheck(applicationId);
    const after = Date.now();

    // The selected delay is within [10, 20] ms,
    // modulo the database round-trip latency
    // between reading the clock and persisting
    // the job.
    const toleranceMs = 250;
    const delayFromBefore = job.scheduledFor.getTime() - before;
    const delayFromAfter = job.scheduledFor.getTime() - after;
    expect(delayFromBefore).toBeGreaterThanOrEqual(10);
    expect(delayFromBefore).toBeLessThanOrEqual(
      20 + toleranceMs,
    );
    expect(delayFromAfter).toBeGreaterThanOrEqual(
      10 - toleranceMs,
    );
    expect(delayFromAfter).toBeLessThanOrEqual(20);
  });

  it('rejects a duplicate schedule for the same application (unique constraint)', async () => {
    const applicationId = await createApplication();

    await service.scheduleCreditCheck(applicationId);

    await expect(
      service.scheduleCreditCheck(applicationId),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('gives each job to exactly one worker under concurrent claiming', async () => {
    const applicationIds = await Promise.all(
      Array.from({ length: 10 }, () => createApplication()),
    );
    await Promise.all(
      applicationIds.map((id) => service.scheduleCreditCheck(id)),
    );
    const due = new Date(Date.now() + 1_000);

    // Ten workers race for the same ten jobs.
    const claims = await Promise.all(
      Array.from({ length: 10 }, (_, worker) =>
        service.claimDueJobs(`worker-${worker}`, due),
      ),
    );

    const claimedIds = claims.flat().map((job) => job.id);
    // Every job claimed exactly once: no duplicates, no losses.
    expect(claimedIds).toHaveLength(10);
    expect(new Set(claimedIds).size).toBe(10);

    const jobs = await prisma.creditCheckJob.findMany();
    expect(
      jobs.every((job) => job.status === CreditCheckJobStatus.PROCESSING),
    ).toBe(true);
    expect(jobs.every((job) => job.attempts === 1)).toBe(true);
  });

  it('cannot complete the same application twice (concurrent completion)', async () => {
    const applicationId = await createApplication();
    const job = await service.scheduleCreditCheck(applicationId);
    await service.claimDueJobs(WORKER_A, new Date(Date.now() + 1_000));

    // Two workers (one of which lost ownership) complete the
    // same job concurrently: only the owner writes.
    const [owner, stranger] = await Promise.all([
      service.completeJob(job.id, WORKER_A),
      service.completeJob(job.id, WORKER_B),
    ]);

    expect(owner).toEqual({
      status: 'completed',
      decision: ApplicationStatus.APPROVED,
      applicationTransitioned: true,
    });
    expect(stranger).toEqual({ status: 'not-owned' });

    const application = await prisma.loanApplication.findUnique({
      where: { id: applicationId },
    });
    expect(application?.status).toBe(ApplicationStatus.APPROVED);

    const jobs = await prisma.creditCheckJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe(CreditCheckJobStatus.COMPLETED);
  });

  it('preserves an existing decision (never overwrites a completed application)', async () => {
    const applicationId = await createApplication();
    await prisma.loanApplication.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.REJECTED },
    });

    const job = await service.scheduleCreditCheck(applicationId);
    await service.claimDueJobs(
      WORKER_A,
      new Date(Date.now() + 1_000),
    );
    const result = await service.completeJob(job.id, WORKER_A);

    expect(result).toEqual({
      status: 'completed',
      decision: ApplicationStatus.APPROVED,
      applicationTransitioned: false,
    });

    const application = await prisma.loanApplication.findUnique({
      where: { id: applicationId },
    });
    expect(application?.status).toBe(ApplicationStatus.REJECTED);
  });

  it('retries failed processing with a backoff and bounds the attempts', async () => {
    const applicationId = await createApplication();
    const job = await service.scheduleCreditCheck(applicationId);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const claimed = await service.claimDueJobs(
        WORKER_A,
        new Date(Date.now() + attempt * 1_000),
      );
      expect(claimed).toHaveLength(1);

      await service.failJob(job.id, WORKER_A, new Error('bureau unreachable'));

      const persisted = await prisma.creditCheckJob.findUnique({
        where: { id: job.id },
      });
      if (attempt < 3) {
        expect(persisted?.status).toBe(CreditCheckJobStatus.QUEUED);
        expect(persisted?.attempts).toBe(attempt);
        // Requeued with a retry delay, not immediately due.
        expect(persisted?.scheduledFor.getTime()).toBeGreaterThan(
          Date.now(),
        );
      } else {
        expect(persisted?.status).toBe(CreditCheckJobStatus.FAILED);
        expect(persisted?.lastError).toBe('bureau unreachable');
      }
    }
  });

  it('recovers jobs left PROCESSING by an interrupted worker (restart recovery)', async () => {
    const applicationId = await createApplication();
    const job = await service.scheduleCreditCheck(applicationId);

    // A worker claimed the job and died before finishing.
    await service.claimDueJobs(WORKER_A, new Date(Date.now() + 1_000));

    // After the staleness threshold, recovery requeues it.
    const recoveredAt = new Date(Date.now() + 61_000);
    const recovered = await service.recoverInterruptedJobs(recoveredAt);
    expect(recovered).toBe(1);

    const persisted = await prisma.creditCheckJob.findUnique({
      where: { id: job.id },
    });
    expect(persisted?.status).toBe(CreditCheckJobStatus.QUEUED);
    expect(persisted?.lockedBy).toBeNull();

    // Another worker picks it up and completes it.
    const claimed = await service.claimDueJobs(WORKER_B, recoveredAt);
    expect(claimed).toHaveLength(1);
    const result = await service.completeJob(job.id, WORKER_B);
    expect(result).toEqual({
      status: 'completed',
      decision: ApplicationStatus.APPROVED,
      applicationTransitioned: true,
    });

    const application = await prisma.loanApplication.findUnique({
      where: { id: applicationId },
    });
    expect(application?.status).toBe(ApplicationStatus.APPROVED);
  });

  it('requeues FAILED jobs after their cooldown so nothing stays stuck', async () => {
    const applicationId = await createApplication();
    const job = await service.scheduleCreditCheck(applicationId);

    // Exhaust the attempt burst.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await service.claimDueJobs(
        WORKER_A,
        new Date(Date.now() + attempt * 1_000),
      );
      await service.failJob(job.id, WORKER_A, new Error('bureau down'));
    }
    let persisted = await prisma.creditCheckJob.findUnique({
      where: { id: job.id },
    });
    expect(persisted?.status).toBe(CreditCheckJobStatus.FAILED);

    // Inside the cooldown nothing happens...
    expect(await service.recoverInterruptedJobs(new Date(Date.now() + 2_000))).toBe(0);

    // ...after the cooldown the job is retried with a fresh budget.
    const afterCooldown = new Date(Date.now() + 6_000);
    expect(await service.recoverInterruptedJobs(afterCooldown)).toBe(1);
    persisted = await prisma.creditCheckJob.findUnique({
      where: { id: job.id },
    });
    expect(persisted?.status).toBe(CreditCheckJobStatus.QUEUED);
    expect(persisted?.attempts).toBe(0);
  });

  it('does not reprocess completed jobs', async () => {
    const applicationId = await createApplication();
    const job = await service.scheduleCreditCheck(applicationId);
    await service.claimDueJobs(WORKER_A, new Date(Date.now() + 1_000));
    await service.completeJob(job.id, WORKER_A);

    const claimed = await service.claimDueJobs(
      WORKER_B,
      new Date(Date.now() + 2_000),
    );
    expect(claimed).toHaveLength(0);

    const again = await service.completeJob(job.id, WORKER_A);
    expect(again).toEqual({ status: 'not-owned' });
  });

  it('adopts pending applications without a job (restart recovery for lost jobs)', async () => {
    const applicationId = await createApplication();

    const adopted = await service.adoptOrphanedPendingApplications();
    expect(adopted).toBe(1);

    const jobs = await prisma.creditCheckJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].applicationId).toBe(applicationId);
    expect(jobs[0].status).toBe(CreditCheckJobStatus.QUEUED);

    // Idempotent: the next sweep schedules nothing new.
    expect(await service.adoptOrphanedPendingApplications()).toBe(0);
    expect(
      (await prisma.creditCheckJob.findMany()).length,
    ).toBe(1);
  });
});
