import { LoanPurposesService } from './loan-purposes.service';
import type { LoanPurpose } from '../domain/loan-purpose';
import type { PrismaService } from '@org/database';

const PURPOSES: readonly LoanPurpose[] = [
  {
    id: 'purpose-a',
    code: 'PURPOSE_A',
    name: 'Purpose A',
    description: 'First purpose',
    isActive: true,
  },
  {
    id: 'purpose-b',
    code: 'PURPOSE_B',
    name: 'Purpose B',
    description: 'Second purpose',
    isActive: false,
  },
];

const CACHE_TTL_MS = 60_000;
const EXTERNAL_DELAY_MS = 10;

function createExternalBankingSystem() {
  return {
    fetchLoanPurposes: jest.fn().mockImplementation(
      () =>
        new Promise<readonly LoanPurpose[]>((resolve) => {
          setTimeout(
            () => resolve(PURPOSES.map((purpose) => ({ ...purpose }))),
            EXTERNAL_DELAY_MS,
          );
        }),
    ),
  };
}

function createPrisma() {
  return {
    loanPurpose: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('LoanPurposesService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getPurposes', () => {
    it('fetches the catalog from the external banking system on the first request', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      const pending = service.getPurposes();
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      const purposes = await pending;

      expect(external.fetchLoanPurposes).toHaveBeenCalledTimes(1);
      expect(purposes).toHaveLength(PURPOSES.length);
      expect(purposes[0].code).toBe('PURPOSE_A');
    });

    it('serves subsequent requests from the cache without repeating the external delay', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      const first = service.getPurposes();
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      await first;

      const second = await service.getPurposes();
      const third = await service.getPurposes();

      expect(external.fetchLoanPurposes).toHaveBeenCalledTimes(1);
      expect(second).toHaveLength(PURPOSES.length);
      expect(third).toHaveLength(PURPOSES.length);
    });

    it('refetches from the external system once the cache TTL expires', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      const first = service.getPurposes();
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      await first;

      jest.advanceTimersByTime(CACHE_TTL_MS + 1);

      const pending = service.getPurposes();
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      await pending;

      expect(external.fetchLoanPurposes).toHaveBeenCalledTimes(2);
    });

    it('shares a single in-flight fetch between concurrent requests', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      const pending = [
        service.getPurposes(),
        service.getPurposes(),
        service.getPurposes(),
      ];
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      const results = await Promise.all(pending);

      expect(external.fetchLoanPurposes).toHaveBeenCalledTimes(1);
      expect(results[0]).toHaveLength(PURPOSES.length);
      expect(results[1]).toHaveLength(PURPOSES.length);
      expect(results[2]).toHaveLength(PURPOSES.length);
    });

    it('retries the external system after a failed fetch', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      external.fetchLoanPurposes.mockRejectedValueOnce(
        new Error('external banking system unavailable'),
      );

      await expect(service.getPurposes()).rejects.toThrow(
        'external banking system unavailable',
      );

      const pending = service.getPurposes();
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      const purposes = await pending;

      expect(external.fetchLoanPurposes).toHaveBeenCalledTimes(2);
      expect(purposes).toHaveLength(PURPOSES.length);
    });

    it('mirrors the external catalog into the database for referential integrity', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      const pending = service.getPurposes();
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      await pending;

      expect(prisma.loanPurpose.upsert).toHaveBeenCalledWith({
        where: { code: 'PURPOSE_A' },
        create: {
          id: 'purpose-a',
          code: 'PURPOSE_A',
          name: 'Purpose A',
          description: 'First purpose',
          isActive: true,
        },
        update: {
          name: 'Purpose A',
          description: 'First purpose',
          isActive: true,
        },
      });
      expect(prisma.loanPurpose.upsert).toHaveBeenCalledWith({
        where: { code: 'PURPOSE_B' },
        create: {
          id: 'purpose-b',
          code: 'PURPOSE_B',
          name: 'Purpose B',
          description: 'Second purpose',
          isActive: false,
        },
        update: {
          name: 'Purpose B',
          description: 'Second purpose',
          isActive: false,
        },
      });
    });
  });

  describe('findPurposeById', () => {
    it('resolves a purpose from the cached catalog', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      const pending = service.findPurposeById('purpose-a');
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      const purpose = await pending;

      expect(purpose).not.toBeNull();
      expect(purpose?.code).toBe('PURPOSE_A');
      expect(purpose?.isActive).toBe(true);
    });

    it('returns null for an unknown purpose id', async () => {
      const external = createExternalBankingSystem();
      const prisma = createPrisma();
      const service = new LoanPurposesService(
        external as never,
        prisma as unknown as PrismaService,
        CACHE_TTL_MS,
      );

      const pending = service.findPurposeById('unknown-purpose');
      await jest.advanceTimersByTimeAsync(EXTERNAL_DELAY_MS);
      const purpose = await pending;

      expect(purpose).toBeNull();
    });
  });
});
