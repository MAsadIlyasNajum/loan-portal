import type { UserRole } from './user-role';

/**
 * The authenticated principal attached to an incoming request by the JWT
 * strategy. The role is always resolved from the database at request time;
 * it is never read from the JWT payload, so a stale or forged role claim
 * cannot grant privileges.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
}

/**
 * An HTTP request whose `user` property has been populated by `JwtAuthGuard`.
 * Structurally compatible with an Express `Request` carrying a passport user.
 */
export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}
