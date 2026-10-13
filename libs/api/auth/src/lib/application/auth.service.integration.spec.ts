import { execSync } from 'node:child_process';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { join } from 'node:path';
import { PrismaService } from '@org/database';
import { AuthService } from './auth.service';
import { Argon2PasswordHasher } from '../infrastructure/password/argon2.password-hasher';
import { LoginUserDto } from '../presentation/dto/login-user.dto';
import { RegisterUserDto } from '../presentation/dto/register-user.dto';
import { UserRole } from '../domain/user-role';

/**
 * Real-MySQL integration tests for the authentication
 * service.
 *
 * These tests run only when AUTH_TEST_DATABASE_URL points at a
 * disposable MySQL database (they are skipped otherwise, so the
 * unit-test target stays green on machines without MySQL):
 *
 *   libs/api/auth/prisma/setup-test-database.sh
 *   AUTH_TEST_DATABASE_URL="mysql://loan_user:loan_password@localhost:3306/loan_portal_auth_test?schema=public" \
 *     nx test auth
 *
 * The setup script (idempotent, non-destructive) creates the
 * disposable database, grants the application user access and
 * applies pending migrations with `prisma migrate deploy` —
 * forward migrations only, no resets, no destructive commands.
 *
 * Cleanup: rows created by the tests are deleted in afterAll;
 * the disposable database itself is left in place for
 * inspection and is re-migrated (idempotently) on the next run.
 */
const TEST_DATABASE_URL = process.env['AUTH_TEST_DATABASE_URL'];
const describeWithMySql = TEST_DATABASE_URL ? describe : describe.skip;

if (!TEST_DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.log(
    'MySQL integration tests skipped: run libs/api/auth/prisma/setup-test-database.sh and set AUTH_TEST_DATABASE_URL to run them against a disposable MySQL database.',
  );
}

const TEST_JWT_SECRET =
  'integration-test-jwt-secret-at-least-32-chars!';

function registerDto(email: string, password: string): RegisterUserDto {
  return { email, password };
}

function loginDto(email: string, password: string): LoginUserDto {
  return { email, password };
}

describeWithMySql('AuthService (MySQL integration)', () => {
  let prisma: PrismaService;
  let service: AuthService;
  let passwordHasher: Argon2PasswordHasher;
  let jwtService: JwtService;
  let originalDatabaseUrl: string | undefined;

  beforeAll(() => {
    originalDatabaseUrl = process.env['DATABASE_URL'];

    // Apply pending migrations to the disposable database
    // (forward-only, idempotent). The database itself is
    // provisioned by libs/api/auth/prisma/setup-test-database.sh.
    try {
      execSync(
        'pnpm exec prisma migrate deploy --config prisma/config.ts --schema=prisma/schema.prisma',
        {
          cwd: join(__dirname, '../../../..', 'database'),
          env: {
            ...process.env,
            DATABASE_URL: TEST_DATABASE_URL,
          },
          stdio: 'pipe',
        },
      );
    } catch (error) {
      throw new Error(
        'Could not prepare the disposable MySQL test database. ' +
          'Run libs/api/auth/prisma/setup-test-database.sh first, ' +
          'then re-run with AUTH_TEST_DATABASE_URL set. ' +
          `Underlying error: ${(error as Error).message}`,
      );
    }

    // Connect the test PrismaService to the disposable database.
    process.env['DATABASE_URL'] = TEST_DATABASE_URL;
    prisma = new PrismaService();
    return prisma
      .$connect()
      .then(() => {
        process.env['DATABASE_URL'] = originalDatabaseUrl;

        passwordHasher = new Argon2PasswordHasher();
        jwtService = new JwtService({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        });
        service = new AuthService(
          prisma,
          passwordHasher,
          jwtService,
        );
      })
      .catch((error: Error) => {
        process.env['DATABASE_URL'] = originalDatabaseUrl;
        throw error;
      });
  });

  afterAll(async () => {
    if (prisma) {
      // Cleanup: remove rows created by these tests. The
      // disposable database itself is left in place.
      await prisma.user.deleteMany().catch(() => undefined);
      await prisma.$disconnect();
    }
    if (originalDatabaseUrl !== undefined) {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('creates a user through the real Prisma client with a normalized email', async () => {
    const user = await service.register(
      registerDto('  Integration.Test@Example.COM ', 'password123'),
    );

    expect(user.email).toBe('integration.test@example.com');
    expect(user.role).toBe(UserRole.CUSTOMER);

    const persisted = await prisma.user.findUnique({
      where: { email: 'integration.test@example.com' },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.email).toBe('integration.test@example.com');
  });

  it('persists an Argon2id password hash that verifies against the real password', async () => {
    await service.register(
      registerDto('hash@example.com', 'password123'),
    );

    const persisted = await prisma.user.findUnique({
      where: { email: 'hash@example.com' },
    });
    expect(persisted?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(
      await passwordHasher.verify(
        'password123',
        persisted?.passwordHash ?? '',
      ),
    ).toBe(true);
    expect(
      await passwordHasher.verify(
        'wrong-password',
        persisted?.passwordHash ?? '',
      ),
    ).toBe(false);
  });

  it('enforces normalized-email uniqueness through the database constraint', async () => {
    await service.register(registerDto('unique@example.com', 'password123'));

    await expect(
      service.register(
        registerDto('UNIQUE@EXAMPLE.COM', 'anotherpassword456'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    // Only one row exists for the normalized address.
    const users = await prisma.user.findMany({
      where: { email: 'unique@example.com' },
    });
    expect(users).toHaveLength(1);
  });

  it('handles concurrent registration of the same email (duplicate race)', async () => {
    const results = await Promise.allSettled([
      service.register(registerDto('race@example.com', 'password123')),
      service.register(registerDto('race@example.com', 'password123')),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);

    const users = await prisma.user.findMany({
      where: { email: 'race@example.com' },
    });
    expect(users).toHaveLength(1);
  });

  it('authenticates a user and returns a verifiable JWT without exposing the hash', async () => {
    await service.register(
      registerDto('login@example.com', 'password123'),
    );

    const result = await service.login(
      loginDto('LOGIN@example.com', 'password123'),
    );

    expect(result.user.email).toBe('login@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toBeDefined();

    const payload = jwtService.verify(result.accessToken, {
      secret: TEST_JWT_SECRET,
    }) as { sub: string; exp: number };
    const persisted = await prisma.user.findUnique({
      where: { email: 'login@example.com' },
    });
    expect(payload.sub).toBe(persisted?.id);
    expect(payload.exp).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
  });

  it('rejects an incorrect password with a generic 401', async () => {
    await service.register(
      registerDto('fail-login@example.com', 'password123'),
    );

    await expect(
      service.login(loginDto('fail-login@example.com', 'nope')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resolves the current role from the database (role freshness)', async () => {
    // An administrator is provisioned directly in the database,
    // as the admin bootstrap script would do.
    const admin = await prisma.user.create({
      data: {
        email: 'fresh-admin@example.com',
        passwordHash: await passwordHasher.hash('password123'),
        role: UserRole.CUSTOMER,
      },
    });

    // The current role is CUSTOMER.
    let current = await service.validateUserById(admin.id);
    expect(current.role).toBe(UserRole.CUSTOMER);

    // The role is promoted in the database (an explicit
    // administrative action).
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: UserRole.ADMIN },
    });

    // The next resolution reflects the change immediately —
    // no stale role can authorize privileged operations.
    current = await service.validateUserById(admin.id);
    expect(current.role).toBe(UserRole.ADMIN);
  });

  it('rejects a deleted user immediately (revocation)', async () => {
    const user = await service.register(
      registerDto('revoke@example.com', 'password123'),
    );

    await prisma.user.delete({ where: { id: user.id } });

    await expect(service.validateUserById(user.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
