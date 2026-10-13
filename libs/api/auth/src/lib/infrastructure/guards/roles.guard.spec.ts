import {
  ForbiddenException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../domain/authenticated-user';
import { UserRole } from '../../domain/user-role';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class TestController {
  @Roles(UserRole.ADMIN)
  adminOnly() {
    return 'admin-only';
  }

  @Roles(UserRole.CUSTOMER)
  customerOnly() {
    return 'customer-only';
  }

  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  anyAuthenticated() {
    return 'any-authenticated';
  }

  noRolesMetadata() {
    return 'no-roles-metadata';
  }
}

function createExecutionContext(
  user: AuthenticatedRequest['user'] | undefined,
  handler: () => void,
  controller: object,
): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const controller = new TestController();

  describe('routes without @Roles metadata', () => {
    it('allows access (the guard does not restrict roles)', () => {
      const context = createExecutionContext(
        { id: 'user-1', email: 'user@example.com', role: UserRole.CUSTOMER },
        controller.noRolesMetadata,
        controller,
      );
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('authorized users', () => {
    it('allows an ADMIN on an admin-only route', () => {
      const context = createExecutionContext(
        { id: 'user-1', email: 'admin@example.com', role: UserRole.ADMIN },
        controller.adminOnly,
        controller,
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows a CUSTOMER on a customer-only route', () => {
      const context = createExecutionContext(
        { id: 'user-2', email: 'customer@example.com', role: UserRole.CUSTOMER },
        controller.customerOnly,
        controller,
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows any listed role', () => {
      const context = createExecutionContext(
        { id: 'user-1', email: 'admin@example.com', role: UserRole.ADMIN },
        controller.anyAuthenticated,
        controller,
      );
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('unauthorized users', () => {
    it('rejects a CUSTOMER on an admin-only route with 403', () => {
      const context = createExecutionContext(
        { id: 'user-2', email: 'customer@example.com', role: UserRole.CUSTOMER },
        controller.adminOnly,
        controller,
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('rejects an ADMIN on a customer-only route with 403', () => {
      const context = createExecutionContext(
        { id: 'user-1', email: 'admin@example.com', role: UserRole.ADMIN },
        controller.customerOnly,
        controller,
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('rejects a request without an authenticated user with 401', () => {
      const context = createExecutionContext(
        undefined,
        controller.adminOnly,
        controller,
      );
      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('role freshness', () => {
    it('does not trust a stale or forged ADMIN role from a token', () => {
      // Simulates the principal produced by JwtStrategy: the role was
      // resolved from the database (CUSTOMER) even though a stale or
      // forged token claimed ADMIN. The guard must decide from the
      // database-resolved role only.
      const context = createExecutionContext(
        { id: 'user-2', email: 'customer@example.com', role: UserRole.CUSTOMER },
        controller.adminOnly,
        controller,
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
