import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@org/database';
import { normalizeEmail } from '../domain/email';
import { AuthenticatedUser } from '../domain/authenticated-user';
import { UserRole } from '../domain/user-role';
import { PasswordHasher } from '../infrastructure/password/password-hasher';
import { RegisterUserDto } from '../presentation/dto/register-user.dto';
import { LoginUserDto } from '../presentation/dto/login-user.dto';

/**
 * Result of a successful login: a signed JWT and the public
 * representation of the authenticated user. Password hashes are
 * never included.
 */
export interface LoginResult {
  readonly accessToken: string;
  readonly user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registers a new customer. The role is always assigned server-side
   * as CUSTOMER; public registration cannot create administrators.
   * Email uniqueness is enforced by the database's unique constraint,
   * so concurrent registrations of the same normalized address are
   * rejected safely as a 409 Conflict.
   */
  async register(dto: RegisterUserDto): Promise<AuthenticatedUser> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.CUSTOMER,
        },
      });
      return toAuthenticatedUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A user with this email address already exists.',
        );
      }
      throw error;
    }
  }

  /**
   * Authenticates a user by email and password. Unknown users and
   * incorrect passwords produce the same generic error to avoid
   * disclosing which email addresses are registered.
   */
  async login(dto: LoginUserDto): Promise<LoginResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await this.passwordHasher.verify(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // The token carries only the stable database id in `sub`.
    // It intentionally contains no role claim: roles are always
    // resolved from the database when authorizing a request.
    const accessToken = await this.jwtService.signAsync({ sub: user.id });

    return { accessToken, user: toAuthenticatedUser(user) };
  }

  /**
   * Resolves the current database state of a user by id. Used by the
   * JWT strategy on every authenticated request so role changes take
   * effect immediately and deleted users lose access.
   */
  async validateUserById(id: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return toAuthenticatedUser(user);
  }
}

function toAuthenticatedUser(user: {
  id: string;
  email: string;
  role: UserRole;
}): AuthenticatedUser {
  return { id: user.id, email: user.email, role: user.role };
}
