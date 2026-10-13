import { Argon2PasswordHasher } from './argon2.password-hasher';

describe('Argon2PasswordHasher', () => {
  let hasher: Argon2PasswordHasher;

  beforeEach(() => {
    hasher = new Argon2PasswordHasher();
  });

  it('produces an Argon2id hash', async () => {
    const hash = await hasher.hash('correct-horse-battery-1');
    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('uses a random salt (hashes differ for the same password)', async () => {
    const hash1 = await hasher.hash('same-password-1');
    const hash2 = await hasher.hash('same-password-1');
    expect(hash1).not.toBe(hash2);
  });

  it('verifies the correct password', async () => {
    const hash = await hasher.hash('correct-horse-battery-1');
    expect(await hasher.verify('correct-horse-battery-1', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('correct-horse-battery-1');
    expect(await hasher.verify('wrong-password-2', hash)).toBe(false);
  });

  it('rejects a malformed hash instead of throwing', async () => {
    expect(await hasher.verify('password', 'not-a-valid-hash')).toBe(false);
  });
});
