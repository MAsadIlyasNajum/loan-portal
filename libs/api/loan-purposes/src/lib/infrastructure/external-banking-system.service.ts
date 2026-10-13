import { Inject, Injectable } from '@nestjs/common';
import { LoanPurpose } from '../domain/loan-purpose';

/**
 * Injection token for the simulated external banking
 * system's response delay in milliseconds.
 */
export const EXTERNAL_BANKING_SYSTEM_DELAY_MS =
  'EXTERNAL_BANKING_SYSTEM_DELAY_MS';

/**
 * Simulates the external banking system that owns the master
 * catalog of loan purposes.
 *
 * Every fetch incurs the configured round-trip delay (2 seconds
 * by default, matching the external system's observed latency).
 * That latency is exactly why responses must be cached by
 * {@link LoanPurposesService} instead of being fetched on every
 * request.
 */
@Injectable()
export class ExternalBankingSystemService {
  /**
   * The external system's current catalog. In production this
   * data would be fetched over the network; here the payload is
   * fixed while the latency is real, so caching behaviour is
   * observable and testable.
   */
  private static readonly LOAN_PURPOSES: readonly LoanPurpose[] = [
    {
      id: 'purpose-home-renovation',
      code: 'HOME_RENOVATION',
      name: 'Home Renovation',
      description: 'Home improvements, repairs and renovations',
      isActive: true,
    },
    {
      id: 'purpose-education',
      code: 'EDUCATION',
      name: 'Education',
      description: 'Tuition and other education-related expenses',
      isActive: true,
    },
    {
      id: 'purpose-medical',
      code: 'MEDICAL',
      name: 'Medical',
      description: 'Medical treatment and healthcare expenses',
      isActive: true,
    },
    {
      id: 'purpose-wedding',
      code: 'WEDDING',
      name: 'Wedding',
      description: 'Wedding and related expenses',
      isActive: true,
    },
    {
      id: 'purpose-debt-consolidation',
      code: 'DEBT_CONSOLIDATION',
      name: 'Debt Consolidation',
      description: 'Consolidating existing debts into a single repayment',
      isActive: true,
    },
    {
      id: 'purpose-vehicle',
      code: 'VEHICLE',
      name: 'Vehicle',
      description: 'Vehicle purchase and related costs',
      isActive: true,
    },
    {
      id: 'purpose-business',
      code: 'BUSINESS',
      name: 'Business',
      description: 'Business and working capital needs',
      isActive: true,
    },
    {
      id: 'purpose-personal',
      code: 'PERSONAL',
      name: 'Personal',
      description: 'General personal expenses',
      isActive: true,
    },
  ];

  constructor(
    @Inject(EXTERNAL_BANKING_SYSTEM_DELAY_MS)
    private readonly responseDelayMs: number,
  ) {}

  /**
   * Fetches the loan purpose catalog from the external banking
   * system, incurring the simulated round-trip delay. Callers
   * should cache the result; this method must not be invoked on
   * every request.
   */
  async fetchLoanPurposes(): Promise<readonly LoanPurpose[]> {
    await delay(this.responseDelayMs);
    // Defensive copies so a caller cannot mutate the catalog
    // or a previously issued response.
    return ExternalBankingSystemService.LOAN_PURPOSES.map(
      (purpose) => ({ ...purpose }),
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
