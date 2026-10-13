/**
 * A loan purpose as published by the external banking system.
 *
 * The `id` is assigned by the external system and is stable
 * across fetches, so clients can reference a purpose (for
 * example in a loan application) between cache refreshes.
 */
export interface LoanPurpose {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
}
