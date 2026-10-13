import { Inject, Injectable } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { CREDIT_CHECK_APPROVAL_RATE } from './credit-check-config';

/**
 * Simulates the external credit bureau that decides
 * whether a loan application is approved.
 *
 * The decision is random (50/50 by default, tunable
 * through CREDIT_CHECK_APPROVAL_RATE) because the
 * real bureau's response is out of scope for this
 * portal; the delay before the decision becomes
 * visible is what matters operationally and is
 * handled by the job queue's scheduling.
 */
@Injectable()
export class SimulatedCreditBureauService {
  constructor(
    @Inject(CREDIT_CHECK_APPROVAL_RATE)
    private readonly approvalRate: number,
  ) {}

  /**
   * Returns the bureau's decision for a credit
   * check: either APPROVED or REJECTED.
   */
  async decide(): Promise<ApplicationStatus> {
    return Math.random() < this.approvalRate
      ? ApplicationStatus.APPROVED
      : ApplicationStatus.REJECTED;
  }
}
