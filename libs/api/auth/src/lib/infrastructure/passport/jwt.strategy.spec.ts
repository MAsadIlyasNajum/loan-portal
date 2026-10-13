import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AuthenticatedRequest } from '../../domain/authenticated-user';
import { UserRole } from '../../domain/user-role';
import { JwtAuthGuard } from '../passport/jwt-auth.guard';
import { JwtStrategy } from '../passport/jwt.strategy';

const TEST_JWT_SECRET =
  'strategy-test-jwt-secret-that-is-at-least-32-chars!';

const OTHER_SECRET =
  'another-secret-that-is-at-least-32-characters-long!!';

const DB_USER = {
  id: 'user-1',
  email: 'user@example.com',
  role: UserRole.CUSTOMER,
};

function createPrismaMock(user: unknown) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
    },
  } as any;
}

interface MockRequest {
  headers?: { authorization?: string };
  user?: AuthenticatedRequest['user'];
}

function createExecutionContext(
  authorization?: string,
): ExecutionContext {
  const request: MockRequest = authorization
    ? { headers: { authorization } }
    : { headers: {} };
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function signToken(
  payload: Record<string, unknown>,
  options?: Pick<JwtSignOptions, 'expiresIn'>,
): string {
  const jwtService = new JwtService({
    secret: TEST_JWT_SECRET,
    signOptions: { expiresIn: '15m' },
  });
  return jwtService.sign(payload, options);
}

describe('JwtStrategy / JwtAuthGuard', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock(DB_USER);
    // Instantiating the strategy registers it with passport
    // under the "jwt" name used by JwtAuthGuard.
    new JwtStrategy(
      { secret: TEST_JWT_SECRET, expiresIn: '15m' } as never,
      prisma,
    );
  });

  it('authenticates a valid bearer token and attaches the database user', async () => {
    const guard = new JwtAuthGuard();
    const token = signToken({ sub: 'user-1' });
    const context = createExecutionContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    expect(request.user).toEqual(DB_USER);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('rejects a request without an authorization header', async () => {
    const guard = new JwtAuthGuard();
    const context = createExecutionContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a malformed token', async () => {
    const guard = new JwtAuthGuard();
    const context = createExecutionContext('Bearer not-a-jwt');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with the wrong secret', async () => {
    const jwtService = new JwtService({
      secret: OTHER_SECRET,
      signOptions: { expiresIn: '15m' },
    });
    const token = jwtService.sign({ sub: 'user-1' });
    const guard = new JwtAuthGuard();
    const context = createExecutionContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const token = signToken({ sub: 'user-1' }, { expiresIn: '0s' });
    const guard = new JwtAuthGuard();
    const context = createExecutionContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token for a user that no longer exists (revocation)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const token = signToken({ sub: 'deleted-user' });
    const guard = new JwtAuthGuard();
    const context = createExecutionContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('ignores a forged role claim and uses the database role', async () => {
    // The token claims ADMIN, but the database user is a CUSTOMER.
    // The strategy must resolve the role from the database, so the
    // authenticated principal carries CUSTOMER.
    const token = signToken({ sub: 'user-1', role: 'ADMIN' });
    const guard = new JwtAuthGuard();
    const context = createExecutionContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    expect(request.user?.role).toBe(UserRole.CUSTOMER);
  });

  it('rejects a token signed with an algorithm other than HS256', async () => {
    // The strategy only accepts HS256. A token signed with
    // HS384 using the same secret must still be rejected.
    const jwtService = new JwtService({
      secret: TEST_JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    });
    const token = jwtService.sign(
      { sub: 'user-1' },
      { algorithm: 'HS384' },
    );
    const guard = new JwtAuthGuard();
    const context = createExecutionContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
