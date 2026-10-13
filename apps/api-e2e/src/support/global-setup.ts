import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { waitForPortOpen } from '@nx/node/utils';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './e2e-config';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'mysql://loan_user:loan_password@localhost:3306/loan_portal?schema=public';

/**
 * The specs submit applications with deterministic NRICs
 * (a fixed baseline plus a per-run counter), so every run
 * must start from an empty loan_applications table to
 * stay repeatable.
 */
async function cleanLoanApplications(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(DATABASE_URL),
  });
  try {
    await prisma.loanApplication.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  // Provision the e2e admin account through the supported
  // bootstrap script. The script is idempotent and is the
  // only supported way to create an Admin; it never runs
  // during API startup. Jest transpiles this setup file
  // into its cache, so the workspace root (the current
  // working directory) is the reliable anchor for paths.
  const workspaceRoot = process.cwd();
  const seed = spawnSync(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', 'prisma/seed-admin.ts'],
    {
      cwd: join(workspaceRoot, 'libs', 'api', 'auth'),
      env: {
        ...process.env,
        // The jest/ts-node toolchain injects these
        // into the test workers; the seed script is
        // a standalone process and must not inherit
        // them — they would override the script's
        // own tsconfig (TS_NODE_COMPILER_OPTIONS
        // forces a deprecated moduleResolution that
        // newer TypeScript versions reject).
        TS_NODE_COMPILER_OPTIONS: undefined,
        TS_JEST: undefined,
        TS_NODE_PROJECT: 'tsconfig.script.json',
        ADMIN_BOOTSTRAP_EMAIL: E2E_ADMIN_EMAIL,
        ADMIN_BOOTSTRAP_PASSWORD: E2E_ADMIN_PASSWORD,
      },
      stdio: 'pipe',
    },
  );
  if (seed.status !== 0) {
    throw new Error(
      'Failed to provision the e2e admin account: ' +
        (seed.stderr?.toString() ?? ''),
    );
  }

  await cleanLoanApplications();

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await waitForPortOpen(port, { host });

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
