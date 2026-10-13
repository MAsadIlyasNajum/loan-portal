import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@org/database';
import { AuthenticatedUser } from '../../domain/authenticated-user';
import { JWT_CONFIG } from '../config/jwt.config';
import type { JwtConfig } from '../config/jwt.config';
import { JwtPayload } from './jwt-payload';

/**
 * Verifies the bearer token's signature and expiry (HS256 only —
 * the algorithm is fixed by server configuration, never taken from
 * the token itself) and then resolves the user from the database.
 *
 * Resolving the user on every request is deliberate: authorization
 * decisions therefore always use the current database role, and a
 * deleted user's token stops working immediately.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(JWT_CONFIG) jwtConfig: JwtConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.secret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, role: user.role };
  }
}
