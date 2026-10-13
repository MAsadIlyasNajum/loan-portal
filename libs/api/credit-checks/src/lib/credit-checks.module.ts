import { Module } from '@nestjs/common';
import {
  CREDIT_CHECK_APPROVAL_RATE,
  CREDIT_CHECK_BATCH_SIZE,
  CREDIT_CHECK_FAILED_RETRY_MS,
  CREDIT_CHECK_MAX_ATTEMPTS,
  CREDIT_CHECK_MAX_DELAY_MS,
  CREDIT_CHECK_MIN_DELAY_MS,
  CREDIT_CHECK_POLL_INTERVAL_MS,
  CREDIT_CHECK_RETRY_DELAY_MS,
  CREDIT_CHECK_STALE_JOB_MS,
  DEFAULT_CREDIT_CHECK_APPROVAL_RATE,
  DEFAULT_CREDIT_CHECK_BATCH_SIZE,
  DEFAULT_CREDIT_CHECK_FAILED_RETRY_MS,
  DEFAULT_CREDIT_CHECK_MAX_ATTEMPTS,
  DEFAULT_CREDIT_CHECK_MAX_DELAY_MS,
  DEFAULT_CREDIT_CHECK_MIN_DELAY_MS,
  DEFAULT_CREDIT_CHECK_POLL_INTERVAL_MS,
  DEFAULT_CREDIT_CHECK_RETRY_DELAY_MS,
  DEFAULT_CREDIT_CHECK_STALE_JOB_MS,
  toNonNegativeInteger,
  toProbability,
} from './infrastructure/credit-check-config';
import { SimulatedCreditBureauService } from './infrastructure/simulated-credit-bureau.service';
import { CreditChecksService } from './application/credit-checks.service';
import { CreditCheckSchedulerService } from './application/credit-check-scheduler.service';

/**
 * Asynchronous credit check processing.
 *
 * Provides the durable, database-backed job
 * queue ({@link CreditChecksService}) and the
 * background scheduler
 * ({@link CreditCheckSchedulerService}) that
 * recovers interrupted work on startup and
 * processes due credit checks.
 */
@Module({
  providers: [
    CreditChecksService,
    CreditCheckSchedulerService,
    SimulatedCreditBureauService,
    {
      provide: CREDIT_CHECK_MIN_DELAY_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_MIN_DELAY_MS'],
          DEFAULT_CREDIT_CHECK_MIN_DELAY_MS,
        ),
    },
    {
      provide: CREDIT_CHECK_MAX_DELAY_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_MAX_DELAY_MS'],
          DEFAULT_CREDIT_CHECK_MAX_DELAY_MS,
        ),
    },
    {
      provide: CREDIT_CHECK_POLL_INTERVAL_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_POLL_INTERVAL_MS'],
          DEFAULT_CREDIT_CHECK_POLL_INTERVAL_MS,
        ),
    },
    {
      provide: CREDIT_CHECK_STALE_JOB_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_STALE_JOB_MS'],
          DEFAULT_CREDIT_CHECK_STALE_JOB_MS,
        ),
    },
    {
      provide: CREDIT_CHECK_MAX_ATTEMPTS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_MAX_ATTEMPTS'],
          DEFAULT_CREDIT_CHECK_MAX_ATTEMPTS,
        ),
    },
    {
      provide: CREDIT_CHECK_RETRY_DELAY_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_RETRY_DELAY_MS'],
          DEFAULT_CREDIT_CHECK_RETRY_DELAY_MS,
        ),
    },
    {
      provide: CREDIT_CHECK_FAILED_RETRY_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_FAILED_RETRY_MS'],
          DEFAULT_CREDIT_CHECK_FAILED_RETRY_MS,
        ),
    },
    {
      provide: CREDIT_CHECK_BATCH_SIZE,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['CREDIT_CHECK_BATCH_SIZE'],
          DEFAULT_CREDIT_CHECK_BATCH_SIZE,
        ),
    },
    {
      provide: CREDIT_CHECK_APPROVAL_RATE,
      useFactory: () =>
        toProbability(
          process.env['CREDIT_CHECK_APPROVAL_RATE'],
          DEFAULT_CREDIT_CHECK_APPROVAL_RATE,
        ),
    },
  ],
  exports: [CreditChecksService],
})
export class CreditChecksModule {}
