import axios from 'axios';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../support/e2e-config';

const REGISTER_URL = '/api/auth/register';
const LOGIN_URL = '/api/auth/login';
const LOANS_URL = '/api/loans';
const PURPOSES_URL = '/api/loan-purposes';

let nricCounter = 0;

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

function uniqueNric(): string {
  nricCounter += 1;
  // 900101 = 1990-01-01 (a valid date of birth),
  // 14 = birthplace code; the padded counter and
  // trailing gender digit keep every NRIC unique.
  return `90010114${String(nricCounter).padStart(3, '0')}${
    nricCounter % 10
  }`;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

interface Session {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

async function registerAndLogin(prefix: string): Promise<Session> {
  const email = uniqueEmail(prefix);
  const password = 'e2e-password-1';
  await axios.post(REGISTER_URL, { email, password });
  const res = await axios.post(LOGIN_URL, { email, password });
  return { accessToken: res.data.accessToken, user: res.data.user };
}

const validApplication = {
  fullName: 'John Doe',
  nric: '900101-14-5678',
  phone: '+6012-345-6789',
  email: 'john.doe@example.com',
  monthlyIncome: 5000,
  loanAmount: 20000,
  tenureMonths: 24,
  purposeId: 'purpose-personal',
};

describe('Loan Applications API', () => {
  let customer: Session;
  let otherCustomer: Session;
  let admin: Session;

  beforeAll(async () => {
    customer = await registerAndLogin('e2e-loans-customer');
    otherCustomer = await registerAndLogin('e2e-loans-other');
    admin = await registerAndLogin('e2e-loans-admin');

    // The global setup provisions the bootstrap admin;
    // promote the admin session through login.
    const res = await axios.post(LOGIN_URL, {
      email: E2E_ADMIN_EMAIL,
      password: E2E_ADMIN_PASSWORD,
    });
    admin = { accessToken: res.data.accessToken, user: res.data.user };

    // Warm the loan purposes cache so application
    // submissions do not each pay the external
    // system's simulated round trip.
    await axios.get(PURPOSES_URL, {
      headers: authHeaders(customer.accessToken),
    });
  }, 20_000);

  describe('POST /api/loans', () => {
    it('rejects an unauthenticated request with 401', async () => {
      const res = await axios
        .post(LOANS_URL, validApplication)
        .catch((error) => error.response);

      expect(res.status).toBe(401);
    });

    it('submits an application as PENDING for the authenticated customer', async () => {
      const payload = {
        ...validApplication,
        nric: uniqueNric(),
        email: uniqueEmail('e2e-applicant'),
      };

      const res = await axios.post(LOANS_URL, payload, {
        headers: authHeaders(customer.accessToken),
      });

      expect(res.status).toBe(201);
      expect(res.data.status).toBe('PENDING');
      expect(res.data.fullName).toBe('John Doe');
      expect(res.data.nric).toBe(payload.nric.replace('-', ''));
      expect(res.data.phone).toBe('0123456789');
      expect(res.data.email).toBe(payload.email);
      expect(res.data.monthlyIncome).toBe(5000);
      expect(res.data.requestedAmount).toBe(20000);
      expect(res.data.tenureMonths).toBe(24);
      expect(res.data.purposeId).toBe('purpose-personal');
      expect(res.data.id).toBeDefined();
      expect(res.data).not.toHaveProperty('userId');
    });

    it('rejects an invalid NRIC with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            nric: '90010114567',
            email: uniqueEmail('e2e-bad-nric'),
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects an NRIC with an impossible date of birth with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            nric: '900231145678',
            email: uniqueEmail('e2e-bad-nric-dob'),
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects a foreign phone number with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            phone: '+15550101234',
            nric: uniqueNric(),
            email: uniqueEmail('e2e-bad-phone'),
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects a malformed email with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            email: 'not-an-email',
            nric: uniqueNric(),
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects a non-positive income with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            monthlyIncome: 0,
            nric: uniqueNric(),
            email: uniqueEmail('e2e-bad-income'),
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects a tenure outside the allowed range with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            tenureMonths: 3,
            nric: uniqueNric(),
            email: uniqueEmail('e2e-bad-tenure'),
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects an unknown purpose with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            purposeId: 'purpose-does-not-exist',
            nric: uniqueNric(),
            email: uniqueEmail('e2e-bad-purpose'),
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects unexpected properties (mass-assignment protection) with 400', async () => {
      const res = await axios
        .post(
          LOANS_URL,
          {
            ...validApplication,
            nric: uniqueNric(),
            email: uniqueEmail('e2e-mass-assign'),
            userId: otherCustomer.user.id,
            status: 'APPROVED',
          },
          { headers: authHeaders(customer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('rejects a duplicate NRIC with 409', async () => {
      const nric = uniqueNric();
      const email = uniqueEmail('e2e-duplicate-nric');
      await axios.post(
        LOANS_URL,
        { ...validApplication, nric, email },
        { headers: authHeaders(customer.accessToken) },
      );

      const res = await axios
        .post(
          LOANS_URL,
          { ...validApplication, nric, email: uniqueEmail('e2e-dup-2') },
          { headers: authHeaders(otherCustomer.accessToken) },
        )
        .catch((error) => error.response);

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/loans', () => {
    let ownApplicationId: string;

    beforeAll(async () => {
      const res = await axios.post(
        LOANS_URL,
        {
          ...validApplication,
          nric: uniqueNric(),
          email: uniqueEmail('e2e-own-list'),
        },
        { headers: authHeaders(customer.accessToken) },
      );
      ownApplicationId = res.data.id;
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await axios.get(LOANS_URL).catch((error) => error.response);

      expect(res.status).toBe(401);
    });

    it('returns only the customer\'s own applications', async () => {
      // The other customer submits an application too.
      await axios.post(
        LOANS_URL,
        {
          ...validApplication,
          nric: uniqueNric(),
          email: uniqueEmail('e2e-other-list'),
        },
        { headers: authHeaders(otherCustomer.accessToken) },
      );

      const res = await axios.get(LOANS_URL, {
        headers: authHeaders(customer.accessToken),
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      const ids = res.data.map((application: { id: string }) => application.id);
      expect(ids).toContain(ownApplicationId);
      // Only the customer's own applications are returned:
      // every entry belongs to the authenticated user.
      const otherRes = await axios.get(LOANS_URL, {
        headers: authHeaders(otherCustomer.accessToken),
      });
      const otherIds = otherRes.data.map(
        (application: { id: string }) => application.id,
      );
      expect(otherIds).not.toContain(ownApplicationId);
      expect(ids).not.toContain(otherIds[0]);
    });

    it('filters the customer\'s own applications by status', async () => {
      const res = await axios.get(`${LOANS_URL}?status=PENDING`, {
        headers: authHeaders(customer.accessToken),
      });

      expect(res.status).toBe(200);
      expect(res.data.length).toBeGreaterThan(0);
      for (const application of res.data) {
        expect(application.status).toBe('PENDING');
      }
    });

    it('rejects an invalid status filter with 400', async () => {
      const res = await axios
        .get(`${LOANS_URL}?status=BOGUS`, {
          headers: authHeaders(customer.accessToken),
        })
        .catch((error) => error.response);

      expect(res.status).toBe(400);
    });

    it('returns all customers\' applications for an admin', async () => {
      const res = await axios.get(LOANS_URL, {
        headers: authHeaders(admin.accessToken),
      });

      expect(res.status).toBe(200);
      const ids = res.data.map((application: { id: string }) => application.id);
      expect(ids).toContain(ownApplicationId);
      expect(res.data.length).toBeGreaterThan(1);
    });

    it('filters all customers\' applications by status for an admin', async () => {
      const res = await axios.get(`${LOANS_URL}?status=PENDING`, {
        headers: authHeaders(admin.accessToken),
      });

      expect(res.status).toBe(200);
      expect(res.data.length).toBeGreaterThan(1);
      for (const application of res.data) {
        expect(application.status).toBe('PENDING');
      }
    });
  });

  describe('GET /api/loans/:id', () => {
    let ownApplicationId: string;
    let foreignApplicationId: string;

    beforeAll(async () => {
      const own = await axios.post(
        LOANS_URL,
        {
          ...validApplication,
          nric: uniqueNric(),
          email: uniqueEmail('e2e-detail-own'),
        },
        { headers: authHeaders(customer.accessToken) },
      );
      ownApplicationId = own.data.id;

      const foreign = await axios.post(
        LOANS_URL,
        {
          ...validApplication,
          fullName: 'Jane Smith',
          nric: uniqueNric(),
          email: uniqueEmail('e2e-detail-foreign'),
        },
        { headers: authHeaders(otherCustomer.accessToken) },
      );
      foreignApplicationId = foreign.data.id;
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await axios
        .get(`${LOANS_URL}/${ownApplicationId}`)
        .catch((error) => error.response);

      expect(res.status).toBe(401);
    });

    it('returns the customer\'s own application details', async () => {
      const res = await axios.get(`${LOANS_URL}/${ownApplicationId}`, {
        headers: authHeaders(customer.accessToken),
      });

      expect(res.status).toBe(200);
      expect(res.data.id).toBe(ownApplicationId);
      expect(res.data.status).toBe('PENDING');
      expect(res.data.nric).toBeDefined();
    });

    it('rejects a customer reading another user\'s application with 404', async () => {
      const res = await axios
        .get(`${LOANS_URL}/${foreignApplicationId}`, {
          headers: authHeaders(customer.accessToken),
        })
        .catch((error) => error.response);

      expect(res.status).toBe(404);
    });

    it('returns any application for an admin', async () => {
      const res = await axios.get(`${LOANS_URL}/${foreignApplicationId}`, {
        headers: authHeaders(admin.accessToken),
      });

      expect(res.status).toBe(200);
      expect(res.data.id).toBe(foreignApplicationId);
      expect(res.data.fullName).toBe('Jane Smith');
    });

    it('rejects an unknown application with 404', async () => {
      const res = await axios
        .get(`${LOANS_URL}/00000000-0000-0000-0000-000000000000`, {
          headers: authHeaders(customer.accessToken),
        })
        .catch((error) => error.response);

      expect(res.status).toBe(404);
    });
  });
});
