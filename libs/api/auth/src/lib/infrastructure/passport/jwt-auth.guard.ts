import { AuthGuard } from '@nestjs/passport';

/**
 * Reusable guard that requires a valid JWT bearer token.
 * Apply it to any route that must only be reachable by
 * authenticated users:
 *
 *   @UseGuards(JwtAuthGuard)
 *
 * Missing, malformed, expired or incorrectly signed tokens are
 * rejected with HTTP 401.
 */
export class JwtAuthGuard extends AuthGuard('jwt') {}
