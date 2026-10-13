import type { CreditCheckJob } from '@prisma/client';
import { CreditCheckSchedulerService } from './credit-check-scheduler.service';
import type { CreditChecksService } from './credit-checks.service';

function job(id: string): CreditCheckJob {
  return {
    id,
    applicationId: `application-${id}`,
    status: 'PROCESSING' as CreditCheckJob['status'],
    scheduledFor: new Date(),
    attempts: 1,
    maxAttempts: 5,
    outcome: null,
    lastError: null,
    lockedAt: new Date(),
    lockedBy: 'worker',
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('CreditCheckSchedulerService', () => {
  let creditChecks: {
    recoverInterruptedJobs: jest.Mock;
    adoptOrphanedPendingApplications: jest.Mock;
    claimDueJobs: jest.Mock;
    completeJob: jest.Mock;
    failJob: jest.Mock;
  };
  let scheduler: CreditCheckSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    creditChecks = {
      recoverInterruptedJobs: jest.fn(async () => 0),
      adoptOrphanedPendingApplications: jest.fn(async () => 0),
      claimDueJobs: jest.fn(async () => []),
      completeJob: jest.fn(async () => ({
        status: 'completed' as const,
        decision: 'APPROVED' as const,
        applicationTransitioned: true,
      })),
      failJob: jest.fn(async () => undefined),
    };
    scheduler = new CreditCheckSchedulerService(
      creditChecks as unknown as CreditChecksService,
      1_000,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recovers interrupted work, adopts orphans and processes due jobs on a pass', async () => {
    creditChecks.claimDueJobs.mockResolvedValueOnce([
      job('job-1'),
      job('job-2'),
    ]);

    await scheduler.runOnce('poll');

    expect(creditChecks.recoverInterruptedJobs).toHaveBeenCalledTimes(1);
    expect(creditChecks.adoptOrphanedPendingApplications).toHaveBeenCalledTimes(1);
    expect(creditChecks.claimDueJobs).toHaveBeenCalledTimes(1);
    expect(creditChecks.completeJob).toHaveBeenCalledTimes(2);
    expect(creditChecks.completeJob).toHaveBeenCalledWith('job-1', expect.any(String));
    expect(creditChecks.completeJob).toHaveBeenCalledWith('job-2', expect.any(String));
  });

  it('processes claimed jobs concurrently, not sequentially', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    creditChecks.claimDueJobs.mockResolvedValueOnce([
      job('job-1'),
      job('job-2'),
      job('job-3'),
    ]);
    creditChecks.completeJob.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return {
        status: 'completed' as const,
        decision: 'APPROVED' as const,
        applicationTransitioned: true,
      };
    });

    await scheduler.runOnce('poll');

    expect(maxInFlight).toBe(3);
  });

  it('routes processing errors to the retry path (failJob)', async () => {
    const failure = new Error('bureau unreachable');
    creditChecks.claimDueJobs.mockResolvedValueOnce([job('job-1')]);
    creditChecks.completeJob.mockRejectedValueOnce(failure);

    await scheduler.runOnce('poll');

    expect(creditChecks.failJob).toHaveBeenCalledWith(
      'job-1',
      expect.any(String),
      failure,
    );
  });

  it('keeps processing other jobs when one job fails', async () => {
    creditChecks.claimDueJobs.mockResolvedValueOnce([
      job('job-1'),
      job('job-2'),
    ]);
    creditChecks.completeJob.mockImplementation(async (id: string) => {
      if (id === 'job-1') {
        throw new Error('boom');
      }
      return {
        status: 'completed' as const,
        decision: 'REJECTED' as const,
        applicationTransitioned: true,
      };
    });

    await scheduler.runOnce('poll');

    expect(creditChecks.failJob).toHaveBeenCalledTimes(1);
    expect(creditChecks.completeJob).toHaveBeenCalledTimes(2);
  });

  it('does not overlap concurrent passes', async () => {
    let releaseRecovery: (() => void) | null = null;
    const recoveryGate = new Promise<void>(
      (resolve) => {
        releaseRecovery = resolve;
      },
    );
    creditChecks.recoverInterruptedJobs.mockImplementation(
      async () => {
        await recoveryGate;
        return 0;
      },
    );

    const first = scheduler.runOnce('poll');
    // A second pass starts while the first is still
    // in flight: it must be skipped entirely.
    await scheduler.runOnce('poll');

    expect(creditChecks.recoverInterruptedJobs).toHaveBeenCalledTimes(1);
    expect(creditChecks.claimDueJobs).toHaveBeenCalledTimes(0);

    releaseRecovery?.();
    await first;
  });

  it('runs a recovery pass on bootstrap and then on every poll interval', async () => {
    jest.useFakeTimers();
    creditChecks.claimDueJobs.mockResolvedValue([]);

    scheduler.onApplicationBootstrap();

    // The bootstrap pass runs immediately...
    await jest.advanceTimersByTimeAsync(0);
    expect(creditChecks.recoverInterruptedJobs).toHaveBeenCalledTimes(1);
    expect(creditChecks.claimDueJobs).toHaveBeenCalledTimes(1);

    // ...and once per poll interval.
    await jest.advanceTimersByTimeAsync(1_000);
    expect(creditChecks.recoverInterruptedJobs).toHaveBeenCalledTimes(2);
    expect(creditChecks.claimDueJobs).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(3_000);
    expect(creditChecks.claimDueJobs).toHaveBeenCalledTimes(5);

    scheduler.onModuleDestroy();
  });

  it('stops polling after onModuleDestroy', async () => {
    jest.useFakeTimers();
    creditChecks.claimDueJobs.mockResolvedValue([]);

    scheduler.onApplicationBootstrap();
    scheduler.onModuleDestroy();

    await jest.advanceTimersByTimeAsync(5_000);

    expect(creditChecks.claimDueJobs).toHaveBeenCalledTimes(1);
  });
});
