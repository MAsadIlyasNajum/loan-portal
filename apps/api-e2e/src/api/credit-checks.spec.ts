import axios from 'axios';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../support/e2e-config';

const REGISTER_URL = '/api/auth/register';
const LOGIN_URL = '/api/auth/login';
const LOANS_URL = '/api/loans';
const PURPOSES_URL = '/api/loan-purposes';

/**
 * End-to-end tests for asynchronous credit checks.
 *
 * A real credit check completes after a random
 * 10-second-to-5-minute delay, so these specs only
 * run in short-delay mode: set CREDIT_CHECK_MIN_DELAY_MS
 * and CREDIT_CHECK_MAX_DELAY_MS (in milliseconds) when
 * starting the API, and the env vars propagate to this
 * process:
 *
 *   CREDIT_CHECK_MIN_DELAY_MS=200 CREDIT_CHECK_MAX_DELAY_MS=600 \
 *     nx run api-e2e:e2e
 *
 * Without short delays the specs are skipped (a full
 * five-minute poll does not belong in the e2e suite);
 * every other behaviour of the queue is covered by the
 * credit-checks unit and integration tests.
 */
const SHORT_DELAY_LIMIT_MS = 60_000;
const configuredMaxDelayMs = Number(
  process.env['CREDIT_CHECK_MAX_DELAY_MS'],
);
const shortDelayMode =
  Number.isFinite(configuredMaxDelayMs) &&
  configuredMaxDelayMs > 0 &&
  configuredMaxDelayMs < SHORT_DELAY_LIMIT_MS;
const describeWithShortDelays = shortDelayMode
  ? describe
  : describe.skip;

if (!shortDelayMode) {
  console.log(
    'Credit check e2e specs skipped: run the API with CREDIT_CHECK_MIN_DELAY_MS and CREDIT_CHECK_MAX_DELAY_MS below 60000 to exercise asynchronous credit checks end to end.',
  );
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

let nricCounter = 0;

function uniqueNric(): string {
  nricCounter += 1;
  // 910101 = 1991-01-01 (a valid date of birth,
  // distinct from the loans.spec 900101 range so
  // concurrently running specs never collide on the
  // unique NRIC constraint); 14 = birthplace code;
  // the padded counter and trailing gender digit
  // keep every NRIC unique.
  return `91010114${String(nricCounter).padStart(3, '0')}${
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

describeWithShortDelays('Asynchronous credit checks (e2e)', () => {
  let customer: Session;
  let admin: Session;

  beforeAll(async () => {
    customer = await registerAndLogin('e2e-credit-customer');

    const res = await axios.post(LOGIN_URL, {
      email: E2E_ADMIN_EMAIL,
      password: E2E_ADMIN_PASSWORD,
    });
    admin = {
      accessToken: res.data.accessToken,
      user: res.data.user,
    };

    // Warm the loan purposes cache so application
    // submissions do not each pay the external
    // system's simulated round trip.
    await axios.get(PURPOSES_URL, {
      headers: authHeaders(customer.accessToken),
    });
  }, 30_000);

  it('starts as PENDING and reaches APPROVED or REJECTED after the simulated delay', async () => {
    const payload = {
      ...validApplication,
      nric: uniqueNric(),
      email: uniqueEmail('e2e-credit-applicant'),
    };

    const created = await axios.post(LOANS_URL, payload, {
      headers: authHeaders(customer.accessToken),
    });

    // The application is accepted immediately and
    // starts as PENDING while the credit check is
    // still in flight.
    expect(created.status).toBe(201);
    expect(created.data.status).toBe('PENDING');
    const applicationId = created.data.id;

    // Poll (the established status-visibility
    // mechanism: GET /api/loans/:id) until the
    // credit check completes.
    const maxDelayMs = configuredMaxDelayMs;
    const pollIntervalMs = 200;
    const deadline = Date.now() + maxDelayMs + 30_000;
    let status = created.data.status;
    while (status === 'PENDING' && Date.now() < deadline) {
      await new Promise((resolve) =>
        setTimeout(resolve, pollIntervalMs),
      );
      const res = await axios.get(`${LOANS_URL}/${applicationId}`, {
        headers: authHeaders(customer.accessToken),
      });
      status = res.data.status;
    }

    // The credit check completed with one of the
    // two possible outcomes.
    expect(['APPROVED', 'REJECTED']).toContain(status);

    // The customer and the admin observe the same
    // final decision.
    const customerView = await axios.get(
      `${LOANS_URL}/${applicationId}`,
      { headers: authHeaders(customer.accessToken) },
    );
    expect(customerView.data.status).toBe(status);

    const adminView = await axios.get(
      `${LOANS_URL}/${applicationId}`,
      { headers: authHeaders(admin.accessToken) },
    );
    expect(adminView.data.status).toBe(status);

    // The terminal status is filterable in the list.
    const list = await axios.get(
      `${LOANS_URL}?status=${status}`,
      { headers: authHeaders(customer.accessToken) },
    );
    const ids = list.data.map(
      (application: { id: string }) => application.id,
    );
    expect(ids).toContain(applicationId);
  }, 120_000);

  it('never reprocesses a completed application (decision is stable)', async () => {
    const payload = {
      ...validApplication,
      nric: uniqueNric(),
      email: uniqueEmail('e2e-credit-stable'),
    };

    const created = await axios.post(LOANS_URL, payload, {
      headers: authHeaders(customer.accessToken),
    });
    const applicationId = created.data.id;

    const maxDelayMs = configuredMaxDelayMs;
    const deadline = Date.now() + maxDelayMs + 30_000;
    let status = 'PENDING';
    while (status === 'PENDING' && Date.now() < deadline) {
      await new Promise((resolve) =>
        setTimeout(resolve, 200),
      );
      const res = await axios.get(`${LOANS_URL}/${applicationId}`, {
        headers: authHeaders(customer.accessToken),
      });
      status = res.data.status;
    }

    expect(['APPROVED', 'REJECTED']).toContain(status);

    // Well past the credit check's completion: the
    // decision is final and does not flip.
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(maxDelayMs, 1000)),
    );
    const final = await axios.get(`${LOANS_URL}/${applicationId}`, {
      headers: authHeaders(customer.accessToken),
    });
    expect(final.data.status).toBe(status);
  }, 120_000);
});
