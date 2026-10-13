import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ApplicationStatus,
  CreditCheckJob,
  CreditCheckJobStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@org/database';
import {
  CREDIT_CHECK_BATCH_SIZE,
  CREDIT_CHECK_FAILED_RETRY_MS,
  CREDIT_CHECK_MAX_ATTEMPTS,
  CREDIT_CHECK_MAX_DELAY_MS,
  CREDIT_CHECK_MIN_DELAY_MS,
  CREDIT_CHECK_RETRY_DELAY_MS,
  CREDIT_CHECK_STALE_JOB_MS,
} from '../infrastructure/credit-check-config';
import { SimulatedCreditBureauService } from '../infrastructure/simulated-credit-bureau.service';

/**
 * How a claimed credit check job finished.
 *
 * - `completed`: the job row reached COMPLETED.
 *   `applicationTransitioned` reports whether the
 *   application itself moved from PENDING to the
 *   decision (false means it already had a final
 *   status, which is preserved untouched).
 * - `not-owned`: the job is no longer owned by
 *   this worker (recovery reset it, another
 *   worker claimed it, or it was already
 *   finished). Nothing was written.
 */
export type CreditCheckCompletion =
  | {
      status: 'completed';
      decision: ApplicationStatus;
      applicationTransitioned: boolean;
    }
  | { status: 'not-owned' };

/**
 * Durable, database-backed queue for
 * asynchronous credit checks.
 *
 * Every state change goes through an atomic,
 * guarded `updateMany` (a compare-and-swap on
 * the job's expected status), so:
 *
 * - only one worker can claim a given job,
 *   even with several schedulers running;
 * - a completed decision can never be
 *   overwritten, because the application only
 *   transitions out of PENDING;
 * - retries, duplicate deliveries and crashed
 *   workers cannot complete the same
 *   application twice or produce conflicting
 *   results.
 */
@Injectable()
export class CreditChecksService {
  private readonly logger = new Logger(
    CreditChecksService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly bureau: SimulatedCreditBureauService,
    @Inject(CREDIT_CHECK_MIN_DELAY_MS)
    private readonly minDelayMs: number,
    @Inject(CREDIT_CHECK_MAX_DELAY_MS)
    private readonly maxDelayMs: number,
    @Inject(CREDIT_CHECK_STALE_JOB_MS)
    private readonly staleJobMs: number,
    @Inject(CREDIT_CHECK_MAX_ATTEMPTS)
    private readonly maxAttempts: number,
    @Inject(CREDIT_CHECK_RETRY_DELAY_MS)
    private readonly retryDelayMs: number,
    @Inject(CREDIT_CHECK_FAILED_RETRY_MS)
    private readonly failedRetryMs: number,
    @Inject(CREDIT_CHECK_BATCH_SIZE)
    private readonly batchSize: number,
  ) {}

  /**
   * The random delay before a new credit check
   * becomes due: uniformly distributed between
   * the configured minimum (10 seconds by
   * default) and maximum (5 minutes by default).
   */
  randomDelayMs(): number {
    const min = Math.min(this.minDelayMs, this.maxDelayMs);
    const max = Math.max(this.minDelayMs, this.maxDelayMs);
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  /**
   * Schedules the credit check for an application.
   *
   * The job row is durable, so the scheduled
   * check survives process restarts. Pass a
   * transaction client to schedule the check in
   * the same transaction that creates the
   * application, making the two writes atomic.
   *
   * The unique constraint on applicationId
   * rejects a second job for the same
   * application, so a credit check can never be
   * scheduled twice for one application.
   */
  async scheduleCreditCheck(
    applicationId: string,
    client?: Prisma.TransactionClient,
  ): Promise<CreditCheckJob> {
    const dataSource = client ?? this.prisma;
    return dataSource.creditCheckJob.create({
      data: {
        applicationId,
        status: CreditCheckJobStatus.QUEUED,
        scheduledFor: new Date(
          Date.now() + this.randomDelayMs(),
        ),
        maxAttempts: this.maxAttempts,
      },
    });
  }

  /**
   * Atomically claims due QUEUED jobs for a
   * worker.
   *
   * Candidates are read without a lock, then
   * each one is claimed with a compare-and-swap:
   * the `updateMany` only matches rows that are
   * still QUEUED, so exactly one concurrent
   * worker wins any given job. Only the jobs
   * whose claim succeeded are returned.
   */
  async claimDueJobs(
    workerId: string,
    now: Date = new Date(),
  ): Promise<CreditCheckJob[]> {
    const candidates =
      await this.prisma.creditCheckJob.findMany({
        where: {
          status: CreditCheckJobStatus.QUEUED,
          scheduledFor: { lte: now },
        },
        orderBy: { scheduledFor: 'asc' },
        take: this.batchSize,
      });

    const claimed: CreditCheckJob[] = [];
    for (const candidate of candidates) {
      const result =
        await this.prisma.creditCheckJob.updateMany({
          where: {
            id: candidate.id,
            status: CreditCheckJobStatus.QUEUED,
          },
          data: {
            status: CreditCheckJobStatus.PROCESSING,
            lockedAt: now,
            lockedBy: workerId,
            attempts: { increment: 1 },
          },
        });
      if (result.count === 1) {
        claimed.push({
          ...candidate,
          status: CreditCheckJobStatus.PROCESSING,
          lockedAt: now,
          lockedBy: workerId,
          attempts: candidate.attempts + 1,
        });
      }
    }
    return claimed;
  }

  /**
   * Processes a claimed job: obtains the bureau's
   * decision and applies it to the application.
   *
   * The application transition is an atomic
   * `updateMany` guarded on PENDING, so a final
   * decision can never be overwritten — not even
   * by a duplicate execution of the same job
   * (for example a worker that was too slow and
   * lost its job to recovery). The job is only
   * marked COMPLETED while this worker still
   * owns it.
   */
  async completeJob(
    jobId: string,
    workerId: string,
  ): Promise<CreditCheckCompletion> {
    const job =
      await this.prisma.creditCheckJob.findUnique({
        where: { id: jobId },
      });
    if (
      !job ||
      job.status !== CreditCheckJobStatus.PROCESSING ||
      job.lockedBy !== workerId
    ) {
      // We no longer own this job: recovery reset
      // it, another worker claimed it, or it was
      // already finished. Write nothing.
      return { status: 'not-owned' };
    }

    const decision = await this.bureau.decide();

    // The application is transitioned first: if
    // this worker dies mid-flight, the job stays
    // PROCESSING and recovery will re-run the
    // check, which is idempotent because the
    // transition below then matches zero rows.
    const applicationUpdate =
      await this.prisma.loanApplication.updateMany({
        where: {
          id: job.applicationId,
          status: ApplicationStatus.PENDING,
        },
        data: { status: decision },
      });

    const jobUpdate =
      await this.prisma.creditCheckJob.updateMany({
        where: {
          id: jobId,
          status: CreditCheckJobStatus.PROCESSING,
          lockedBy: workerId,
        },
        data: {
          status: CreditCheckJobStatus.COMPLETED,
          outcome: decision,
          completedAt: new Date(),
          lastError: null,
        },
      });

    if (jobUpdate.count !== 1) {
      return { status: 'not-owned' };
    }

    if (applicationUpdate.count === 0) {
      this.logger.warn(
        `Credit check ${jobId} for application ${job.applicationId} finished, but the application no longer had a PENDING status; its existing decision was preserved.`,
      );
    }

    return {
      status: 'completed',
      decision,
      applicationTransitioned:
        applicationUpdate.count === 1,
    };
  }

  /**
   * Records a processing failure and either
   * requeues the job with a bounded backoff or,
   * once the attempt budget for the current
   * burst is spent, marks it FAILED (recovery
   * requeues failed jobs after a cooldown, so no
   * application is ever left permanently stuck).
   */
  async failJob(
    jobId: string,
    workerId: string,
    error: unknown,
  ): Promise<void> {
    const job =
      await this.prisma.creditCheckJob.findUnique({
        where: { id: jobId },
      });
    if (
      !job ||
      job.status !== CreditCheckJobStatus.PROCESSING ||
      job.lockedBy !== workerId
    ) {
      return;
    }

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (job.attempts >= this.maxAttempts) {
      await this.prisma.creditCheckJob.updateMany({
        where: {
          id: jobId,
          status: CreditCheckJobStatus.PROCESSING,
          lockedBy: workerId,
        },
        data: {
          status: CreditCheckJobStatus.FAILED,
          lastError: message,
        },
      });
      this.logger.error(
        `Credit check job ${jobId} for application ${job.applicationId} failed after ${job.attempts} attempts: ${message}`,
      );
      return;
    }

    await this.prisma.creditCheckJob.updateMany({
      where: {
        id: jobId,
        status: CreditCheckJobStatus.PROCESSING,
        lockedBy: workerId,
      },
      data: {
        status: CreditCheckJobStatus.QUEUED,
        scheduledFor: new Date(
          Date.now() + this.retryDelayMs,
        ),
        lastError: message,
        lockedAt: null,
        lockedBy: null,
      },
    });
    this.logger.warn(
      `Credit check job ${jobId} for application ${job.applicationId} failed (attempt ${job.attempts}/${this.maxAttempts}) and was requeued: ${message}`,
    );
  }

  /**
   * Recovery sweep, run on startup and on every
   * scheduler pass:
   *
   * - jobs left PROCESSING by workers that died
   *   (their lock is older than the staleness
   *   threshold) are requeued for another
   *   attempt, or marked FAILED once their
   *   attempt budget is spent;
   * - FAILED jobs whose cooldown has elapsed are
   *   requeued with a fresh attempt budget, so
   *   interrupted or failing processing can
   *   never leave an application stuck forever.
   *
   * Every reset is a guarded `updateMany`, so
   * concurrent recovery attempts are safe.
   */
  async recoverInterruptedJobs(
    now: Date = new Date(),
  ): Promise<number> {
    const staleCutoff = new Date(
      now.getTime() - this.staleJobMs,
    );
    const stale =
      await this.prisma.creditCheckJob.findMany({
        where: {
          status: CreditCheckJobStatus.PROCESSING,
          lockedAt: { lte: staleCutoff },
        },
        take: this.batchSize,
      });

    let recovered = 0;
    for (const job of stale) {
      if (job.attempts >= this.maxAttempts) {
        const result =
          await this.prisma.creditCheckJob.updateMany({
            where: {
              id: job.id,
              status: CreditCheckJobStatus.PROCESSING,
            },
            data: {
              status: CreditCheckJobStatus.FAILED,
              lastError:
                'Job was interrupted and its attempt budget is exhausted',
            },
          });
        recovered += result.count;
        continue;
      }

      const result =
        await this.prisma.creditCheckJob.updateMany({
          where: {
            id: job.id,
            status: CreditCheckJobStatus.PROCESSING,
          },
          data: {
            status: CreditCheckJobStatus.QUEUED,
            scheduledFor: now,
            lastError: null,
            lockedAt: null,
            lockedBy: null,
          },
        });
      recovered += result.count;
    }

    const failedCutoff = new Date(
      now.getTime() - this.failedRetryMs,
    );
    const failed =
      await this.prisma.creditCheckJob.findMany({
        where: {
          status: CreditCheckJobStatus.FAILED,
          updatedAt: { lte: failedCutoff },
        },
        take: this.batchSize,
      });

    for (const job of failed) {
      // A new attempt burst: the attempt budget
      // is reset, the cooldown bounds how often
      // a persistently failing job is retried.
      const result =
        await this.prisma.creditCheckJob.updateMany({
          where: {
            id: job.id,
            status: CreditCheckJobStatus.FAILED,
          },
          data: {
            status: CreditCheckJobStatus.QUEUED,
            attempts: 0,
            scheduledFor: now,
            lastError: null,
            lockedAt: null,
            lockedBy: null,
          },
        });
      recovered += result.count;
    }

    return recovered;
  }

  /**
   * Restart recovery: finds PENDING applications
   * that have no credit check job (for example
   * applications created before this queue
   * existed, or whose job row was lost) and
   * schedules a fresh credit check for them.
   *
   * The unique constraint on applicationId makes
   * concurrent adoption attempts safe: a racing
   * worker's insert fails with P2002 and is
   * treated as already-adopted.
   */
  async adoptOrphanedPendingApplications(): Promise<number> {
    const orphans =
      await this.prisma.loanApplication.findMany({
        where: {
          status: ApplicationStatus.PENDING,
          creditCheckJob: null,
        },
        take: this.batchSize,
      });

    let adopted = 0;
    for (const application of orphans) {
      try {
        await this.scheduleCreditCheck(application.id);
        adopted += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Another worker adopted this
          // application concurrently.
          continue;
        }
        throw error;
      }
    }

    if (adopted > 0) {
      this.logger.log(
        `Scheduled credit checks for ${adopted} pending application(s) without a job.`,
      );
    }
    return adopted;
  }
}
