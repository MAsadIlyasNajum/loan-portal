/**
 * JWT payload. Only the stable database user id is carried in the
 * token. No role or other identity claims are issued or trusted.
 */
export interface JwtPayload {
  sub: string;
}
