import axios from 'axios';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../support/e2e-config';

const REGISTER_URL = '/api/auth/register';
const LOGIN_URL = '/api/auth/login';
const PURPOSES_URL = '/api/loan-purposes';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

describe('Loan Purposes API', () => {
  let accessToken: string;

  beforeAll(async () => {
    const email = uniqueEmail('e2e-purposes');
    await axios.post(REGISTER_URL, {
      email,
      password: 'e2e-password-1',
    });
    const res = await axios.post(LOGIN_URL, {
      email,
      password: 'e2e-password-1',
    });
    accessToken = res.data.accessToken;
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await axios.get(PURPOSES_URL).catch((error) => error.response);

    expect(res.status).toBe(401);
  });

  it('returns the external banking system catalog to an authenticated user', async () => {
    const res = await axios.get(PURPOSES_URL, {
      headers: authHeaders(accessToken),
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    for (const purpose of res.data) {
      expect(typeof purpose.id).toBe('string');
      expect(typeof purpose.code).toBe('string');
      expect(typeof purpose.name).toBe('string');
      expect(typeof purpose.isActive).toBe('boolean');
    }
  }, 10_000);

  it('serves a repeat request from the cache without repeating the external delay', async () => {
    // The first request (or the first after the cache TTL
    // expires) pays the external banking system's simulated
    // 2-second round trip. A request that follows another
    // request is served from the cache and completes
    // immediately.
    await axios.get(PURPOSES_URL, {
      headers: authHeaders(accessToken),
    });

    const start = Date.now();
    const res = await axios.get(PURPOSES_URL, {
      headers: authHeaders(accessToken),
    });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(1000);
  });

  it('returns a consistent catalog across requests', async () => {
    const first = await axios.get(PURPOSES_URL, {
      headers: authHeaders(accessToken),
    });
    const second = await axios.get(PURPOSES_URL, {
      headers: authHeaders(accessToken),
    });

    expect(second.data).toEqual(first.data);
  });

  it('rejects an invalid bearer token with 401', async () => {
    const res = await axios
      .get(PURPOSES_URL, {
        headers: { Authorization: 'Bearer not-a-jwt' },
      })
      .catch((error) => error.response);

    expect(res.status).toBe(401);
  });

  it('rejects a customer-supplied purpose mutation (read-only catalog)', async () => {
    // The catalog is owned by the external banking system;
    // there is no endpoint to create or modify purposes.
    const res = await axios
      .post(PURPOSES_URL, { name: 'New Purpose' }, { headers: authHeaders(accessToken) })
      .catch((error) => error.response);

    expect(res.status).toBe(404);
  });

  it('provisions the e2e admin through the bootstrap script', async () => {
    // The global setup seeds the admin account; logging in
    // proves the bootstrap worked and the admin can
    // authenticate.
    const res = await axios.post(LOGIN_URL, {
      email: E2E_ADMIN_EMAIL,
      password: E2E_ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.data.user.role).toBe('ADMIN');
    expect(res.data.accessToken).toBeDefined();
  });
});
