import { ApplicationStatus } from '@prisma/client';
import { SimulatedCreditBureauService } from './simulated-credit-bureau.service';
import {
  CREDIT_CHECK_APPROVAL_RATE,
  DEFAULT_CREDIT_CHECK_APPROVAL_RATE,
  toNonNegativeInteger,
  toProbability,
} from './credit-check-config';

function createBureau(approvalRate: number): SimulatedCreditBureauService {
  return new SimulatedCreditBureauService(approvalRate);
}

describe('SimulatedCreditBureauService', () => {
  it('returns only APPROVED or REJECTED decisions', async () => {
    const bureau = createBureau(DEFAULT_CREDIT_CHECK_APPROVAL_RATE);

    for (let i = 0; i < 100; i += 1) {
      const decision = await bureau.decide();
      expect(
        decision === ApplicationStatus.APPROVED ||
          decision === ApplicationStatus.REJECTED,
      ).toBe(true);
    }
  });

  it('produces both possible outcomes', async () => {
    const bureau = createBureau(0.5);
    const decisions = new Set<ApplicationStatus>();

    for (let i = 0; i < 200; i += 1) {
      decisions.add(await bureau.decide());
    }

    expect(decisions).toEqual(
      new Set([ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]),
    );
  });

  it('always approves when the approval rate is 1', async () => {
    const bureau = createBureau(1);

    for (let i = 0; i < 50; i += 1) {
      expect(await bureau.decide()).toBe(ApplicationStatus.APPROVED);
    }
  });

  it('always rejects when the approval rate is 0', async () => {
    const bureau = createBureau(0);

    for (let i = 0; i < 50; i += 1) {
      expect(await bureau.decide()).toBe(ApplicationStatus.REJECTED);
    }
  });
});

describe('credit check configuration', () => {
  it('parses non-negative integers with a fallback', () => {
    expect(toNonNegativeInteger('250', 10)).toBe(250);
    expect(toNonNegativeInteger(undefined, 10)).toBe(10);
    expect(toNonNegativeInteger('nope', 10)).toBe(10);
    expect(toNonNegativeInteger('-5', 10)).toBe(10);
  });

  it('parses probabilities with a fallback', () => {
    expect(toProbability('0.25', 0.5)).toBe(0.25);
    expect(toProbability(undefined, 0.5)).toBe(0.5);
    expect(toProbability('1.5', 0.5)).toBe(0.5);
    expect(toProbability('-1', 0.5)).toBe(0.5);
  });

  it('exposes the credit check configuration tokens', () => {
    expect(CREDIT_CHECK_APPROVAL_RATE).toBe(
      'CREDIT_CHECK_APPROVAL_RATE',
    );
  });
});
