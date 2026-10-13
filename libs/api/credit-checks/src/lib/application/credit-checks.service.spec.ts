import { ApplicationStatus, CreditCheckJobStatus, Prisma } from '@prisma/client';
import type { PrismaService } from '@org/database';
import { CreditChecksService } from './credit-checks.service';
import { SimulatedCreditBureauService } from '../infrastructure/simulated-credit-bureau.service';

/**
 * In-memory Prisma double used by the queue unit
 * tests. It implements the small subset of the Prisma
 * API used by CreditChecksService — including the
 * guarded `updateMany` semantics that the queue's
 * compare-and-swap operations rely on — so the tests
 * exercise the real concurrency guarantees:
 *
 * - `updateMany` only matches rows satisfying every
 *   condition in `where` (equality, `{ lte }` date
 *   filters and `{ increment }` updates supported);
 * - `creditCheckJob.create` enforces the unique
 *   constraint on applicationId (P2002), which is
 *   what prevents duplicate credit checks.
 */
interface JobRow {
  id: string;
  applicationId: string;
  status: CreditCheckJobStatus;
  scheduledFor: Date;
  attempts: number;
  maxAttempts: number;
  outcome: ApplicationStatus | null;
  lastError: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

type JobWhere = {
  id?: string;
  status?: CreditCheckJobStatus;
  lockedBy?: string | null;
  lockedAt?: { lte?: Date };
  scheduledFor?: { lte?: Date };
  updatedAt?: { lte?: Date };
};

type JobData = {
  status?: CreditCheckJobStatus;
  scheduledFor?: Date;
  attempts?: number | { increment: number };
  outcome?: ApplicationStatus | null;
  lastError?: string | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  completedAt?: Date | null;
  maxAttempts?: number;
};

class InMemoryPrismaDouble {
  readonly applications = new Map<string, ApplicationRow>();
  readonly jobs = new Map<string, JobRow>();
  private sequence = 0;

  addApplication(
    id: string,
    status: ApplicationStatus = ApplicationStatus.PENDING,
  ): ApplicationRow {
    const row: ApplicationRow = {
      id,
      status,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.applications.set(id, row);
    return row;
  }

  addJob(
    overrides: Partial<JobRow> & {
      id: string;
      applicationId: string;
    },
  ): JobRow {
    for (const existing of this.jobs.values()) {
      if (existing.applicationId === overrides.applicationId) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on credit_check_jobs_applicationId_key',
          { code: 'P2002', clientVersion: '7.10.0' },
        );
      }
    }
    const row: JobRow = {
      status: CreditCheckJobStatus.QUEUED,
      scheduledFor: new Date(),
      attempts: 0,
      maxAttempts: 5,
      outcome: null,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    this.jobs.set(row.id, row);
    return row;
  }

  readonly creditCheckJob = {
    create: jest.fn(
      async ({ data }: { data: Partial<JobRow> }): Promise<JobRow> => {
        const id = data.id ?? `job-${++this.sequence}`;
        return this.addJob({ ...data, id });
      },
    ),
    findMany: jest.fn(
      async ({
        where = {},
        orderBy,
        take,
      }: {
        where?: JobWhere;
        orderBy?: { scheduledFor?: 'asc' | 'desc' };
        take?: number;
      }): Promise<JobRow[]> => {
        let rows = [...this.jobs.values()].filter((row) =>
          matchesJobWhere(row, where),
        );
        if (orderBy?.scheduledFor) {
          const direction = orderBy.scheduledFor === 'desc' ? -1 : 1;
          rows = rows.sort(
            (a, b) =>
              direction *
              (a.scheduledFor.getTime() - b.scheduledFor.getTime()),
          );
        }
        if (take !== undefined) {
          rows = rows.slice(0, take);
        }
        return rows.map((row) => ({ ...row }));
      },
    ),
    updateMany: jest.fn(
      async ({
        where = {},
        data,
      }: {
        where?: JobWhere;
        data: JobData;
      }): Promise<{ count: number }> => {
      const matched = [...this.jobs.values()].filter((row) =>
        matchesJobWhere(row, where),
      );
      for (const row of matched) {
        applyJobData(row, data);
        row.updatedAt = new Date();
      }
      return { count: matched.length };
    },
    ),
    findUnique: jest.fn(
      async ({ where: { id } }: { where: { id: string } }): Promise<JobRow | null> => {
        const row = this.jobs.get(id);
        return row ? { ...row } : null;
      },
    ),
  };

  readonly loanApplication = {
    findMany: jest.fn(
      async ({
        where = {},
        take,
      }: {
        where?: {
          id?: string;
          status?: ApplicationStatus;
          creditCheckJob?: null;
        };
        take?: number;
      }): Promise<ApplicationRow[]> => {
        let rows = [...this.applications.values()].filter((row) =>
          Object.entries(where).every(([key, expected]) => {
            if (key === 'creditCheckJob') {
              const hasJob = [...this.jobs.values()].some(
                (job) => job.applicationId === row.id,
              );
              return expected === null ? !hasJob : hasJob;
            }
            return (row as Record<string, unknown>)[key] === expected;
          }),
        );
        if (take !== undefined) {
          rows = rows.slice(0, take);
        }
        return rows.map((row) => ({ ...row }));
      },
    ),
    updateMany: jest.fn(
      async ({
        where = {},
        data,
      }: {
        where?: { id?: string; status?: ApplicationStatus };
        data: { status?: ApplicationStatus };
      }): Promise<{ count: number }> => {
        const matched = [...this.applications.values()].filter(
          (row) =>
            (where.id === undefined || row.id === where.id) &&
            (where.status === undefined || row.status === where.status),
        );
        for (const row of matched) {
          if (data.status !== undefined) {
            row.status = data.status;
          }
          row.updatedAt = new Date();
        }
        return { count: matched.length };
      },
    ),
  };
}

function matchesJobWhere(
  row: JobRow,
  where: JobWhere,
): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (
      expected !== null &&
      typeof expected === 'object' &&
      !(expected instanceof Date)
    ) {
      const actual = (row as Record<string, unknown>)[key];
      const filter = expected as { lte?: Date };
      if (filter.lte !== undefined) {
        if (actual === null || actual === undefined) {
          return false;
        }
        return (actual as Date).getTime() <= filter.lte.getTime();
      }
      return true;
    }
    return (row as Record<string, unknown>)[key] === expected;
  });
}

function applyJobData(row: JobRow, data: JobData): void {
  for (const [key, value] of Object.entries(data)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      'increment' in value
    ) {
      const current = (row as Record<string, unknown>)[key] as number;
      (row as Record<string, unknown>)[key] =
        current + (value as { increment: number }).increment;
      continue;
    }
    (row as Record<string, unknown>)[key] = value;
  }
}

const WORKER_A = 'worker-a';
const WORKER_B = 'worker-b';

function createService(
  fake: InMemoryPrismaDouble,
  options: {
    decide?: ApplicationStatus;
    minDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    failedRetryMs?: number;
    staleJobMs?: number;
    batchSize?: number;
  } = {},
): CreditChecksService {
  const bureau = {
    decide: jest.fn(async () => options.decide ?? ApplicationStatus.APPROVED),
  };
  return new CreditChecksService(
    fake as unknown as PrismaService,
    bureau as unknown as SimulatedCreditBureauService,
    options.minDelayMs ?? 10_000,
    options.maxDelayMs ?? 300_000,
    options.staleJobMs ?? 120_000,
    options.maxAttempts ?? 5,
    options.retryDelayMs ?? 5_000,
    options.failedRetryMs ?? 300_000,
    options.batchSize ?? 50,
  );
}

describe('CreditChecksService', () => {
  let fake: InMemoryPrismaDouble;

  beforeEach(() => {
    jest.clearAllMocks();
    fake = new InMemoryPrismaDouble();
  });

  describe('randomDelayMs / scheduling delay bounds', () => {
    it('selects a delay within the configured 10s–5min bounds', () => {
      const service = createService(fake, {
        minDelayMs: 10_000,
        maxDelayMs: 300_000,
      });

      for (let i = 0; i < 200; i += 1) {
        const delay = service.randomDelayMs();
        expect(delay).toBeGreaterThanOrEqual(10_000);
        expect(delay).toBeLessThanOrEqual(300_000);
      }
    });

    it('is inclusive of both bounds', () => {
      const service = createService(fake, {
        minDelayMs: 100,
        maxDelayMs: 100,
      });
      expect(service.randomDelayMs()).toBe(100);
    });

    it('schedules the credit check to become due after the random delay', async () => {
      const service = createService(fake, {
        minDelayMs: 10_000,
        maxDelayMs: 300_000,
      });
      fake.addApplication('application-1');

      const before = Date.now();
      const job = await service.scheduleCreditCheck('application-1');
      const after = Date.now();

      expect(job.status).toBe(CreditCheckJobStatus.QUEUED);
      const dueIn = job.scheduledFor.getTime() - before;
      const dueInFromAfter = job.scheduledFor.getTime() - after;
      expect(dueIn).toBeGreaterThanOrEqual(10_000);
      expect(dueIn).toBeLessThanOrEqual(300_000);
      expect(dueInFromAfter).toBeGreaterThanOrEqual(10_000);
      expect(dueInFromAfter).toBeLessThanOrEqual(300_000);
    });

    it('enforces the unique constraint: a credit check is never scheduled twice for one application', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');

      await service.scheduleCreditCheck('application-1');

      await expect(
        service.scheduleCreditCheck('application-1'),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('schedules within a caller-provided transaction client', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      const transaction = {
        creditCheckJob: {
          create: jest.fn(async ({ data }: { data: Partial<JobRow> }) =>
            fake.addJob({ ...data, id: 'tx-job' }),
          ),
        },
      };

      const job = await service.scheduleCreditCheck(
        'application-1',
        transaction as unknown as Prisma.TransactionClient,
      );

      expect(job.id).toBe('tx-job');
      expect(fake.creditCheckJob.create).not.toHaveBeenCalled();
    });
  });

  describe('claimDueJobs', () => {
    it('claims QUEUED jobs whose scheduledFor has passed', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });

      const claimed = await service.claimDueJobs(WORKER_A);

      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe('job-1');
      expect(claimed[0].status).toBe(CreditCheckJobStatus.PROCESSING);
      expect(claimed[0].lockedBy).toBe(WORKER_A);
      expect(claimed[0].attempts).toBe(1);
      expect(fake.jobs.get('job-1')?.lockedBy).toBe(WORKER_A);
    });

    it('does not claim jobs that are not due yet', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() + 60_000),
      });

      const claimed = await service.claimDueJobs(WORKER_A);

      expect(claimed).toHaveLength(0);
      expect(fake.jobs.get('job-1')?.status).toBe(
        CreditCheckJobStatus.QUEUED,
      );
    });

    it('lets exactly one worker claim a job under concurrent claim attempts', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });

      // Two workers race for the same job: the guarded
      // updateMany only matches the row while it is
      // still QUEUED, so exactly one claim succeeds.
      const [fromA, fromB] = await Promise.all([
        service.claimDueJobs(WORKER_A),
        service.claimDueJobs(WORKER_B),
      ]);

      const totalClaimed = fromA.length + fromB.length;
      expect(totalClaimed).toBe(1);
      expect(fake.jobs.get('job-1')?.attempts).toBe(1);
      expect(fake.jobs.get('job-1')?.lockedAt).not.toBeNull();
    });

    it('never claims COMPLETED or FAILED jobs', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-done',
        applicationId: 'application-1',
        status: CreditCheckJobStatus.COMPLETED,
        scheduledFor: new Date(Date.now() - 1),
      });
      fake.addJob({
        id: 'job-failed',
        applicationId: 'application-2',
        status: CreditCheckJobStatus.FAILED,
        scheduledFor: new Date(Date.now() - 1),
      });
      fake.addApplication('application-2');

      const claimed = await service.claimDueJobs(WORKER_A);

      expect(claimed).toHaveLength(0);
    });
  });

  describe('completeJob', () => {
    it('transitions a PENDING application to APPROVED and completes the job', async () => {
      const service = createService(fake, {
        decide: ApplicationStatus.APPROVED,
      });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      const result = await service.completeJob('job-1', WORKER_A);

      expect(result).toEqual({
        status: 'completed',
        decision: ApplicationStatus.APPROVED,
        applicationTransitioned: true,
      });
      expect(fake.applications.get('application-1')?.status).toBe(
        ApplicationStatus.APPROVED,
      );
      const job = fake.jobs.get('job-1');
      expect(job?.status).toBe(CreditCheckJobStatus.COMPLETED);
      expect(job?.outcome).toBe(ApplicationStatus.APPROVED);
      expect(job?.completedAt).not.toBeNull();
    });

    it('transitions a PENDING application to REJECTED and completes the job', async () => {
      const service = createService(fake, {
        decide: ApplicationStatus.REJECTED,
      });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      const result = await service.completeJob('job-1', WORKER_A);

      expect(result).toEqual({
        status: 'completed',
        decision: ApplicationStatus.REJECTED,
        applicationTransitioned: true,
      });
      expect(fake.applications.get('application-1')?.status).toBe(
        ApplicationStatus.REJECTED,
      );
    });

    it('never overwrites a completed decision (PENDING guard on the application)', async () => {
      const service = createService(fake, {
        decide: ApplicationStatus.REJECTED,
      });
      fake.addApplication('application-1', ApplicationStatus.APPROVED);
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      const result = await service.completeJob('job-1', WORKER_A);

      // The application keeps its existing APPROVED
      // decision; the job still completes so it is
      // never reprocessed.
      expect(result).toEqual({
        status: 'completed',
        decision: ApplicationStatus.REJECTED,
        applicationTransitioned: false,
      });
      expect(fake.applications.get('application-1')?.status).toBe(
        ApplicationStatus.APPROVED,
      );
      expect(fake.jobs.get('job-1')?.status).toBe(
        CreditCheckJobStatus.COMPLETED,
      );
    });

    it('rejects a duplicate execution by a worker that does not own the job', async () => {
      const service = createService(fake, {
        decide: ApplicationStatus.APPROVED,
      });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      // Worker B never claimed the job (or lost it to
      // recovery): its attempt to complete it writes
      // nothing and reports not-owned.
      const result = await service.completeJob('job-1', WORKER_B);

      expect(result).toEqual({ status: 'not-owned' });
      expect(fake.applications.get('application-1')?.status).toBe(
        ApplicationStatus.PENDING,
      );
      expect(fake.jobs.get('job-1')?.status).toBe(
        CreditCheckJobStatus.PROCESSING,
      );
    });

    it('rejects completion of an already completed job (no reprocessing)', async () => {
      const service = createService(fake, {
        decide: ApplicationStatus.APPROVED,
      });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);
      await service.completeJob('job-1', WORKER_A);

      const again = await service.completeJob('job-1', WORKER_A);

      expect(again).toEqual({ status: 'not-owned' });
      expect(fake.applications.get('application-1')?.status).toBe(
        ApplicationStatus.APPROVED,
      );
    });

    it('rejects completion of a job whose ownership was reset by recovery', async () => {
      const service = createService(fake, {
        decide: ApplicationStatus.APPROVED,
      });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      // Recovery requeues the stale job and another
      // worker completes it.
      const recoveredAt = new Date(Date.now() + 121_000);
      await service.recoverInterruptedJobs(recoveredAt);
      await service.claimDueJobs(WORKER_B, recoveredAt);
      const first = await service.completeJob('job-1', WORKER_B);

      // The original (too slow) worker finishes late:
      // its completion is a duplicate execution and
      // must not produce a conflicting result.
      const late = await service.completeJob('job-1', WORKER_A);

      expect(first).toEqual({
        status: 'completed',
        decision: ApplicationStatus.APPROVED,
        applicationTransitioned: true,
      });
      expect(late).toEqual({ status: 'not-owned' });
      expect(fake.applications.get('application-1')?.status).toBe(
        ApplicationStatus.APPROVED,
      );
      expect(fake.jobs.get('job-1')?.status).toBe(
        CreditCheckJobStatus.COMPLETED,
      );
    });
  });

  describe('failJob (bounded retries)', () => {
    it('requeues a failed job with a retry delay while attempts remain', async () => {
      const service = createService(fake, { retryDelayMs: 5_000 });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      await service.failJob('job-1', WORKER_A, new Error('bureau unreachable'));

      const job = fake.jobs.get('job-1');
      expect(job?.status).toBe(CreditCheckJobStatus.QUEUED);
      expect(job?.scheduledFor.getTime()).toBeGreaterThan(Date.now());
      expect(job?.lastError).toBe('bureau unreachable');
      expect(job?.lockedAt).toBeNull();
      expect(job?.lockedBy).toBeNull();
    });

    it('marks a job FAILED once the attempt budget is spent', async () => {
      const service = createService(fake, { maxAttempts: 3 });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        attempts: 3,
        maxAttempts: 3,
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      await service.failJob('job-1', WORKER_A, new Error('bureau down'));

      const job = fake.jobs.get('job-1');
      expect(job?.status).toBe(CreditCheckJobStatus.FAILED);
      expect(job?.lastError).toBe('bureau down');
    });

    it('ignores failures for jobs this worker does not own', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() - 1),
      });
      await service.claimDueJobs(WORKER_A);

      await service.failJob('job-1', WORKER_B, new Error('nope'));

      expect(fake.jobs.get('job-1')?.status).toBe(
        CreditCheckJobStatus.PROCESSING,
      );
    });
  });

  describe('recoverInterruptedJobs (restart recovery)', () => {
    it('requeues jobs left PROCESSING by interrupted workers', async () => {
      const service = createService(fake, { staleJobMs: 120_000 });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-stale',
        applicationId: 'application-1',
        status: CreditCheckJobStatus.PROCESSING,
        lockedAt: new Date(Date.now() - 121_000),
        lockedBy: 'dead-worker',
        scheduledFor: new Date(Date.now() - 1),
      });

      const recovered = await service.recoverInterruptedJobs();

      expect(recovered).toBe(1);
      const job = fake.jobs.get('job-stale');
      expect(job?.status).toBe(CreditCheckJobStatus.QUEUED);
      expect(job?.lockedAt).toBeNull();
      expect(job?.lockedBy).toBeNull();
      // Immediately claimable again by any worker.
      const claimed = await service.claimDueJobs(WORKER_A);
      expect(claimed.map((job) => job.id)).toContain('job-stale');
    });

    it('leaves jobs with a fresh lock alone', async () => {
      const service = createService(fake, { staleJobMs: 120_000 });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-fresh',
        applicationId: 'application-1',
        status: CreditCheckJobStatus.PROCESSING,
        lockedAt: new Date(Date.now() - 1_000),
        lockedBy: WORKER_A,
        scheduledFor: new Date(Date.now() - 1),
      });

      const recovered = await service.recoverInterruptedJobs();

      expect(recovered).toBe(0);
      expect(fake.jobs.get('job-fresh')?.status).toBe(
        CreditCheckJobStatus.PROCESSING,
      );
    });

    it('marks exhausted stale jobs FAILED instead of requeueing them forever', async () => {
      const service = createService(fake, {
        staleJobMs: 120_000,
        maxAttempts: 5,
      });
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-exhausted',
        applicationId: 'application-1',
        status: CreditCheckJobStatus.PROCESSING,
        attempts: 5,
        maxAttempts: 5,
        lockedAt: new Date(Date.now() - 121_000),
        lockedBy: 'dead-worker',
        scheduledFor: new Date(Date.now() - 1),
      });

      const recovered = await service.recoverInterruptedJobs();

      expect(recovered).toBe(1);
      expect(fake.jobs.get('job-exhausted')?.status).toBe(
        CreditCheckJobStatus.FAILED,
      );
    });

    it('requeues FAILED jobs after their cooldown with a fresh attempt budget', async () => {
      const service = createService(fake, { failedRetryMs: 300_000 });
      fake.addApplication('application-1');
      const failedAt = new Date(Date.now() - 301_000);
      fake.addJob({
        id: 'job-failed',
        applicationId: 'application-1',
        status: CreditCheckJobStatus.FAILED,
        attempts: 5,
        maxAttempts: 5,
        updatedAt: failedAt,
        createdAt: failedAt,
        scheduledFor: failedAt,
      });

      const recovered = await service.recoverInterruptedJobs();

      expect(recovered).toBe(1);
      const job = fake.jobs.get('job-failed');
      expect(job?.status).toBe(CreditCheckJobStatus.QUEUED);
      expect(job?.attempts).toBe(0);
    });

    it('leaves FAILED jobs inside their cooldown alone', async () => {
      const service = createService(fake, { failedRetryMs: 300_000 });
      fake.addApplication('application-1');
      const failedAt = new Date(Date.now() - 1_000);
      fake.addJob({
        id: 'job-failed',
        applicationId: 'application-1',
        status: CreditCheckJobStatus.FAILED,
        attempts: 5,
        maxAttempts: 5,
        updatedAt: failedAt,
        createdAt: failedAt,
        scheduledFor: failedAt,
      });

      const recovered = await service.recoverInterruptedJobs();

      expect(recovered).toBe(0);
      expect(fake.jobs.get('job-failed')?.status).toBe(
        CreditCheckJobStatus.FAILED,
      );
    });
  });

  describe('adoptOrphanedPendingApplications', () => {
    it('schedules a credit check for PENDING applications without a job', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      fake.addApplication('application-2');

      const adopted = await service.adoptOrphanedPendingApplications();

      expect(adopted).toBe(2);
      const jobs = [...fake.jobs.values()];
      expect(jobs).toHaveLength(2);
      expect(
        new Set(jobs.map((job) => job.applicationId)),
      ).toEqual(new Set(['application-1', 'application-2']));
    });

    it('does not duplicate jobs for applications that already have one', async () => {
      const service = createService(fake);
      fake.addApplication('application-1');
      fake.addJob({
        id: 'job-1',
        applicationId: 'application-1',
        scheduledFor: new Date(Date.now() + 60_000),
      });

      const adopted = await service.adoptOrphanedPendingApplications();

      expect(adopted).toBe(0);
      expect(fake.jobs.size).toBe(1);
    });

    it('does not adopt applications that already reached a decision', async () => {
      const service = createService(fake);
      fake.addApplication('application-1', ApplicationStatus.APPROVED);

      const adopted = await service.adoptOrphanedPendingApplications();

      expect(adopted).toBe(0);
      expect(fake.jobs.size).toBe(0);
    });
  });
});
