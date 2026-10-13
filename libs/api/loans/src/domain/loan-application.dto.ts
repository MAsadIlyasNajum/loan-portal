import { ApplicationStatus } from '@prisma/client';

/**
 * Public representation of a loan application. The applicant's
 * user id and any internal state are never exposed; ownership
 * is enforced server-side from the authenticated principal.
 */
export interface LoanApplicationDto {
  readonly id: string;
  readonly fullName: string;
  readonly nric: string;
  readonly phone: string;
  readonly email: string;
  readonly monthlyIncome: number;
  readonly requestedAmount: number;
  readonly tenureMonths: number;
  readonly purposeId: string;
  readonly status: ApplicationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
