import { Module } from '@nestjs/common';
import {
  DEFAULT_LOAN_PURPOSES_CACHE_TTL_MS,
  LOAN_PURPOSES_CACHE_TTL_MS,
  LoanPurposesService,
} from './application/loan-purposes.service';
import {
  EXTERNAL_BANKING_SYSTEM_DELAY_MS,
  ExternalBankingSystemService,
} from './infrastructure/external-banking-system.service';
import { LoanPurposesController } from './presentation/loan-purposes.controller';

/**
 * The external banking system's simulated round-trip delay:
 * 2 seconds, matching its observed latency.
 */
const DEFAULT_EXTERNAL_BANKING_SYSTEM_DELAY_MS = 2000;

function toNonNegativeInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.floor(parsed)
    : fallback;
}

@Module({
  controllers: [LoanPurposesController],
  providers: [
    ExternalBankingSystemService,
    LoanPurposesService,
    {
      provide: EXTERNAL_BANKING_SYSTEM_DELAY_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['EXTERNAL_BANKING_SYSTEM_DELAY_MS'],
          DEFAULT_EXTERNAL_BANKING_SYSTEM_DELAY_MS,
        ),
    },
    {
      provide: LOAN_PURPOSES_CACHE_TTL_MS,
      useFactory: () =>
        toNonNegativeInteger(
          process.env['LOAN_PURPOSES_CACHE_TTL_MS'],
          DEFAULT_LOAN_PURPOSES_CACHE_TTL_MS,
        ),
    },
  ],
  exports: [LoanPurposesService],
})
export class LoanPurposesModule {}
