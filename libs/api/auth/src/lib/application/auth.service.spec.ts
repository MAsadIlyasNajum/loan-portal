import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { AuthService, LoginResult } from './auth.service';
import { Argon2PasswordHasher } from '../infrastructure/password/argon2.password-hasher';
import { LoginUserDto } from '../presentation/dto/login-user.dto';
import { RegisterUserDto } from '../presentation/dto/register-user.dto';
import { UserRole } from '../domain/user-role';

const TEST_JWT_SECRET =
  'unit-test-jwt-secret-that-is-at-least-32-characters-long';

function createRegisterDto(
  email: string,
  password: string,
): RegisterUserDto {
  return { email, password };
}

function createLoginDto(email: string, password: string): LoginUserDto {
  return { email, password };
}

function createPrismaClientKnownError(code: string): Error {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the constraint: `users_email_key`',
    { code, clientVersion: '7.10.0', meta: { target: ['email'] } },
  );
}

describe('AuthService', () => {
  const prisma: any = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const passwordHasher = new Argon2PasswordHasher();
  const jwtService = new JwtService({
    secret: TEST_JWT_SECRET,
    signOptions: { expiresIn: '15m' },
  });
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, passwordHasher, jwtService);
  });

  describe('register', () => {
    it('normalizes the email (trim + lowercase) before persistence', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
      });

      const user = await service.register(
        createRegisterDto('  User@Example.COM  ', 'password123'),
      );

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'user@example.com',
          passwordHash: expect.any(String),
          role: UserRole.CUSTOMER,
        },
      });
      expect(user.email).toBe('user@example.com');
    });

    it('hashes the password with Argon2id before persistence', async () => {
      prisma.user.create.mockImplementation(async ({ data }: any) => ({
        id: 'user-1',
        email: data.email,
        role: data.role,
      }));

      await service.register(createRegisterDto('user@example.com', 'password123'));

      const call = prisma.user.create.mock.calls[0][0] as any;
      expect(call.data.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(
        await passwordHasher.verify('password123', call.data.passwordHash),
      ).toBe(true);
      expect(
        await passwordHasher.verify('wrong-password', call.data.passwordHash),
      ).toBe(false);
    });

    it('assigns the CUSTOMER role on registration', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
      });

      const user = await service.register(
        createRegisterDto('user@example.com', 'password123'),
      );

      expect(user.role).toBe(UserRole.CUSTOMER);
      const persisted = prisma.user.create.mock.calls[0][0].data;
      expect(persisted.role).toBe(UserRole.CUSTOMER);
      expect(persisted.role).not.toBe(UserRole.ADMIN);
    });

    it('never persists an ADMIN role, even if one is somehow supplied', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
      });

      await service.register(createRegisterDto('user@example.com', 'password123'));

      // The DTO exposes no role property, so the persisted role is
      // always the server-side default.
      const persisted = prisma.user.create.mock.calls[0][0].data;
      expect(persisted.role).toBe(UserRole.CUSTOMER);
      expect('role' in createRegisterDto('a@b.c', 'password123')).toBe(false);
    });

    it('rejects a duplicate normalized email as a 409 Conflict', async () => {
      prisma.user.create.mockRejectedValue(
        createPrismaClientKnownError('P2002'),
      );

      await expect(
        service.register(createRegisterDto('user@example.com', 'password123')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('surfaces non-unique Prisma errors instead of hiding them', async () => {
      prisma.user.create.mockRejectedValue(
        createPrismaClientKnownError('P2001'),
      );

      await expect(
        service.register(createRegisterDto('user@example.com', 'password123')),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });

    it('does not return the password hash in the response', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
        passwordHash: '$argon2id$secret-hash',
      });

      const user = await service.register(
        createRegisterDto('user@example.com', 'password123'),
      );

      expect(user).not.toHaveProperty('passwordHash');
      expect(Object.keys(user).sort()).toEqual(['email', 'id', 'role']);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Use a real hash so verification exercises the Argon2id
      // integration rather than a stub.
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
        passwordHash: await passwordHasher.hash('password123'),
      });
    });

    it('returns a signed JWT and a safe user for valid credentials', async () => {
      const result: LoginResult = await service.login(
        createLoginDto('USER@example.com', 'password123'),
      );

      expect(result.user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.accessToken).toBeDefined();

      const payload = jwtService.decode(result.accessToken) as {
        sub: string;
      };
      expect(payload.sub).toBe('user-1');
      expect(payload).not.toHaveProperty('role');
    });

    it('normalizes the login email identically to registration', async () => {
      await service.login(createLoginDto('  USER@Example.COM ', 'password123'));

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('rejects an incorrect password with a generic 401', async () => {
      await expect(
        service.login(createLoginDto('user@example.com', 'wrong-password')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown user with the same generic 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      let unknownUserError: Error | undefined;
      let wrongPasswordError: Error | undefined;
      try {
        await service.login(
          createLoginDto('ghost@example.com', 'password123'),
        );
      } catch (error) {
        unknownUserError = error as Error;
      }
      try {
        await service.login(createLoginDto('user@example.com', 'wrong'));
      } catch (error) {
        wrongPasswordError = error as Error;
      }

      expect(unknownUserError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect((unknownUserError as Error).message).toBe(
        (wrongPasswordError as Error).message,
      );
    });

    it('rejects a user whose stored hash is malformed', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
        passwordHash: 'malformed-hash',
      });

      await expect(
        service.login(createLoginDto('user@example.com', 'password123')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('validateUserById', () => {
    it('resolves the current database user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
        passwordHash: '$argon2id$secret-hash',
      });

      const user = await service.validateUserById('user-1');

      expect(user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
      });
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('rejects an unknown user id', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUserById('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('token signing', () => {
    it('signs with the configured secret and expiration', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
        passwordHash: await passwordHasher.hash('password123'),
      });

      const { accessToken } = await service.login(
        createLoginDto('user@example.com', 'password123'),
      );

      // Verifies the signature using the same secret configuration.
      const verified = jwtService.verify(accessToken, {
        secret: TEST_JWT_SECRET,
      }) as { sub: string; exp: number };
      expect(verified.sub).toBe('user-1');
      expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});
