import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { LoanPurpose } from '../domain/loan-purpose';
import { ExternalBankingSystemService } from '../infrastructure/external-banking-system.service';

/**
 * Injection token for the loan purpose cache TTL in
 * milliseconds.
 */
export const LOAN_PURPOSES_CACHE_TTL_MS =
  'LOAN_PURPOSES_CACHE_TTL_MS';

/**
 * The loan purpose catalog rarely changes, so it is cached for
 * an hour by default. Set LOAN_PURPOSES_CACHE_TTL_MS to tune.
 */
export const DEFAULT_LOAN_PURPOSES_CACHE_TTL_MS =
  60 * 60 * 1000;

interface CacheEntry {
  readonly purposes: readonly LoanPurpose[];
  readonly expiresAt: number;
}

/**
 * Serves the loan purpose catalog published by the external
 * banking system.
 *
 * The external system is slow (a simulated 2-second round
 * trip), so responses are cached in memory for a configurable
 * TTL: the first request (or the first request after the cache
 * expires) pays the delay, every following request is served
 * instantly from the cache. Concurrent cache misses share a
 * single in-flight fetch instead of each triggering one.
 *
 * Fetched purposes are mirrored into the local database so
 * loan applications can reference them through a foreign key;
 * the external system remains the source of truth for the
 * catalog itself.
 */
@Injectable()
export class LoanPurposesService {
  private cache: CacheEntry | null = null;
  private inFlight: Promise<readonly LoanPurpose[]> | null = null;

  constructor(
    private readonly externalBankingSystem: ExternalBankingSystemService,
    private readonly prisma: PrismaService,
    @Inject(LOAN_PURPOSES_CACHE_TTL_MS)
    private readonly cacheTtlMs: number,
  ) {}

  /**
   * Returns the loan purpose catalog, served from the cache
   * when fresh and from the external banking system (with the
   * simulated round-trip delay) otherwise.
   */
  async getPurposes(): Promise<readonly LoanPurpose[]> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return [...this.cache.purposes];
    }

    // Single-flight: while a fetch is in progress, concurrent
    // callers await the same promise instead of each paying the
    // external system's round-trip delay.
    if (!this.inFlight) {
      this.inFlight = this.fetchAndCache().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  /**
   * Resolves a single purpose by its external id, using the
   * cached catalog when fresh. Used to validate the purpose of
   * a new loan application.
   */
  async findPurposeById(id: string): Promise<LoanPurpose | null> {
    const purposes = await this.getPurposes();
    return purposes.find((purpose) => purpose.id === id) ?? null;
  }

  private async fetchAndCache(): Promise<readonly LoanPurpose[]> {
    const purposes =
      await this.externalBankingSystem.fetchLoanPurposes();
    await this.mirrorInDatabase(purposes);
    this.cache = {
      purposes,
      expiresAt: Date.now() + this.cacheTtlMs,
    };
    return purposes;
  }

  /**
   * Keeps the local mirror of the external catalog in sync. The
   * external ids are preserved so references remain stable
   * across cache refreshes.
   */
  private async mirrorInDatabase(
    purposes: readonly LoanPurpose[],
  ): Promise<void> {
    await Promise.all(
      purposes.map((purpose) =>
        this.prisma.loanPurpose.upsert({
          where: { code: purpose.code },
          create: {
            id: purpose.id,
            code: purpose.code,
            name: purpose.name,
            description: purpose.description,
            isActive: purpose.isActive,
          },
          update: {
            name: purpose.name,
            description: purpose.description,
            isActive: purpose.isActive,
          },
        }),
      ),
    );
  }
}
