import { ExternalBankingSystemService } from './external-banking-system.service';

describe('ExternalBankingSystemService', () => {
  describe('fetchLoanPurposes', () => {
    it('returns the external banking system catalog', async () => {
      const service = new ExternalBankingSystemService(0);
      const purposes = await service.fetchLoanPurposes();

      expect(purposes.length).toBeGreaterThan(0);
      for (const purpose of purposes) {
        expect(typeof purpose.id).toBe('string');
        expect(typeof purpose.code).toBe('string');
        expect(typeof purpose.name).toBe('string');
        expect(typeof purpose.description).toBe('string');
        expect(typeof purpose.isActive).toBe('boolean');
      }
    });

    it('assigns distinct ids and codes', async () => {
      const service = new ExternalBankingSystemService(0);
      const purposes = await service.fetchLoanPurposes();

      const ids = new Set(purposes.map((purpose) => purpose.id));
      const codes = new Set(purposes.map((purpose) => purpose.code));
      expect(ids.size).toBe(purposes.length);
      expect(codes.size).toBe(purposes.length);
    });

    it('returns defensive copies so the catalog cannot be mutated', async () => {
      const service = new ExternalBankingSystemService(0);
      const first = await service.fetchLoanPurposes();
      const originalName = first[0].name;

      const second = await service.fetchLoanPurposes();

      // Every fetch hands out fresh copies, so a caller
      // cannot reach the catalog (or any other response)
      // through the objects it was given.
      expect(second).not.toBe(first);
      expect(second[0]).not.toBe(first[0]);
      expect(second[0].name).toBe(originalName);
    });

    it('incurs the configured round-trip delay', async () => {
      jest.useFakeTimers();
      try {
        const service = new ExternalBankingSystemService(2000);
        let resolved = false;
        const pending = service.fetchLoanPurposes().then(() => {
          resolved = true;
        });

        await jest.advanceTimersByTimeAsync(1999);
        expect(resolved).toBe(false);

        await jest.advanceTimersByTimeAsync(1);
        await pending;
        expect(resolved).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
