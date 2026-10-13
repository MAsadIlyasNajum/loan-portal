import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../domain/authenticated-user';
import { UserRole } from '../../domain/user-role';
import { ROLES_KEY } from './roles.decorator';

/**
 * Role-based authorization guard. Reads the required roles from
 * {@link Roles} metadata and compares them with the authenticated
 * user's current database role.
 *
 * - Routes without `@Roles` metadata are not restricted by this
 *   guard (they may still require authentication via JwtAuthGuard).
 * - Authenticated users lacking a required role are rejected with
 *   HTTP 403.
 * - Requests without an authenticated user are rejected with HTTP 401;
 *   combine this guard with JwtAuthGuard for protected routes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    return true;
  }
}
