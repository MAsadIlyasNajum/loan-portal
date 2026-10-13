import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreditCheckJob } from '@prisma/client';
import { CreditChecksService } from './credit-checks.service';
import { CREDIT_CHECK_POLL_INTERVAL_MS } from '../infrastructure/credit-check-config';

/**
 * Polls the durable credit check queue and
 * processes due jobs.
 *
 * The queue itself lives in the database, so
 * nothing is lost when the process restarts:
 * on startup (OnApplicationBootstrap) the
 * scheduler immediately runs a recovery pass
 * that requeues jobs left behind by
 * interrupted workers, requeues failed jobs
 * whose cooldown has elapsed, adopts pending
 * applications without a job, and processes
 * everything that is already due. The same
 * pass runs on every poll interval
 * afterwards.
 *
 * Passes never overlap (a pass still in
 * flight is skipped), and jobs are processed
 * concurrently within a pass. Several API
 * instances may run schedulers at the same
 * time; the atomic claim in
 * {@link CreditChecksService.claimDueJobs}
 * guarantees each job is processed by
 * exactly one of them.
 */
@Injectable()
export class CreditCheckSchedulerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(
    CreditCheckSchedulerService.name,
  );
  private readonly workerId = randomUUID();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private readonly creditChecks: CreditChecksService,
    @Inject(CREDIT_CHECK_POLL_INTERVAL_MS)
    private readonly pollIntervalMs: number,
  ) {}

  onApplicationBootstrap(): void {
    // Restart recovery: repair interrupted
    // work and process anything already due
    // before the first regular poll.
    void this.runOnce('startup');
    this.timer = setInterval(
      () => void this.runOnce('poll'),
      this.pollIntervalMs,
    );
    // The poll must not keep the process
    // alive on its own during shutdown.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * One scheduler pass. Concurrent passes are
   * suppressed: if a pass is still running,
   * the next poll is skipped rather than
   * overlapping it.
   */
  async runOnce(
    reason: 'startup' | 'poll',
  ): Promise<void> {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    try {
      const recovered =
        await this.creditChecks.recoverInterruptedJobs();
      if (recovered > 0) {
        this.logger.log(
          `Recovered ${recovered} interrupted credit check job(s) (${reason}).`,
        );
      }

      await this.creditChecks.adoptOrphanedPendingApplications();

      const jobs =
        await this.creditChecks.claimDueJobs(
          this.workerId,
        );
      if (jobs.length > 0) {
        this.logger.log(
          `Claimed ${jobs.length} due credit check job(s) (${reason}).`,
        );
      }

      await Promise.allSettled(
        jobs.map((job) => this.process(job)),
      );
    } catch (error) {
      this.logger.error(
        `Credit check scheduler pass failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      this.ticking = false;
    }
  }

  private async process(
    job: CreditCheckJob,
  ): Promise<void> {
    try {
      const result = await this.creditChecks.completeJob(
        job.id,
        this.workerId,
      );
      if (result.status === 'completed') {
        this.logger.log(
          `Credit check ${job.id} for application ${job.applicationId} completed with ${result.decision}` +
            (result.applicationTransitioned
              ? '.'
              : ' (the application already had a final decision, which was preserved).'),
        );
      }
    } catch (error) {
      this.logger.error(
        `Credit check job ${job.id} for application ${job.applicationId} errored: ${(error as Error).message}`,
        (error as Error).stack,
      );
      await this.creditChecks.failJob(
        job.id,
        this.workerId,
        error,
      );
    }
  }
}
