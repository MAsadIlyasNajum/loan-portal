import axios from 'axios';

const REGISTER_URL = '/api/auth/register';
const LOGIN_URL = '/api/auth/login';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

describe('Authentication API', () => {
  describe('POST /api/auth/register', () => {
    it('registers a customer with a normalized email', async () => {
      const email = `  ${uniqueEmail('e2e-register')}  `.toUpperCase();

      const res = await axios.post(REGISTER_URL, {
        email,
        password: 'e2e-password-1',
      });

      expect(res.status).toBe(201);
      expect(res.data.email).toBe(
        email.trim().toLowerCase(),
      );
      expect(res.data.role).toBe('CUSTOMER');
      expect(res.data.id).toBeDefined();
      expect(res.data).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(res.data)).not.toContain('$argon2id$');
    });

    it('rejects a duplicate normalized email with 409', async () => {
      const email = uniqueEmail('e2e-duplicate');
      await axios.post(REGISTER_URL, {
        email,
        password: 'e2e-password-1',
      });

      const res = await axios
        .post(REGISTER_URL, {
          email: email.toUpperCase(),
          password: 'e2e-password-1',
        })
        .catch((error) => error.response);

      expect(res.status).toBe(409);
    });

    it('rejects unexpected properties (mass assignment) with 400', async () => {
      const res = await axios
        .post(REGISTER_URL, {
          email: uniqueEmail('e2e-mass'),
          password: 'e2e-password-1',
          role: 'ADMIN',
        })
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects a malformed email with 400', async () => {
      const res = await axios
        .post(REGISTER_URL, {
          email: 'not-an-email',
          password: 'e2e-password-1',
        })
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects a weak password with 400', async () => {
      const res = await axios
        .post(REGISTER_URL, {
          email: uniqueEmail('e2e-weak'),
          password: 'short',
        })
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns an access token and a safe user for valid credentials', async () => {
      const email = uniqueEmail('e2e-login');
      await axios.post(REGISTER_URL, {
        email,
        password: 'e2e-password-1',
      });

      const res = await axios.post(LOGIN_URL, {
        email: email.toUpperCase(),
        password: 'e2e-password-1',
      });

      expect(res.status).toBe(200);
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.user.email).toBe(email);
      expect(res.data.user.role).toBe('CUSTOMER');
      expect(res.data.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(res.data)).not.toContain('$argon2id$');

      // The token must be a signed JWT carrying only the
      // user id in its sub claim.
      const payload = JSON.parse(
        Buffer.from(
          res.data.accessToken.split('.')[1],
          'base64url',
        ).toString(),
      );
      expect(payload.sub).toBe(res.data.user.id);
      expect(payload).not.toHaveProperty('role');
      expect(payload.exp).toBeGreaterThan(
        Math.floor(Date.now() / 1000),
      );
    });

    it('rejects an incorrect password with 401 and a generic message', async () => {
      const email = uniqueEmail('e2e-login-fail');
      await axios.post(REGISTER_URL, {
        email,
        password: 'e2e-password-1',
      });

      const res = await axios
        .post(LOGIN_URL, { email, password: 'wrong-password-1' })
        .catch((error) => error.response);

      expect(res.status).toBe(401);
      expect(res.data.message).toBe('Invalid email or password.');
    });

    it('rejects an unknown user with the same generic 401', async () => {
      const res = await axios
        .post(LOGIN_URL, {
          email: uniqueEmail('e2e-ghost'),
          password: 'whatever-password-1',
        })
        .catch((error) => error.response);

      expect(res.status).toBe(401);
      expect(res.data.message).toBe('Invalid email or password.');
    });
  });

  describe('existing endpoints', () => {
    it('keeps the root endpoint public', async () => {
      const res = await axios.get('/api');

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ message: 'Hello API' });
    });
  });
});
