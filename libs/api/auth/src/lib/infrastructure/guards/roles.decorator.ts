import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../domain/user-role';

export const ROLES_KEY = 'roles';

/**
 * Declares the roles allowed to invoke a route or controller:
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN)
 *   @Post('admin/orders')
 *
 * Roles are compared against the role resolved from the database
 * for the authenticated user (see JwtStrategy), never against a
 * role supplied by the client or embedded in a token.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
