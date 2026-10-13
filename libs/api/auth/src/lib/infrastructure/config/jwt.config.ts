/**
 * Injection token for the validated JWT configuration.
 */
export const JWT_CONFIG = 'JWT_CONFIG';

/**
 * JWT configuration, validated once during module initialization.
 * The application fails fast when the required security configuration
 * is missing or too weak; there is no predictable fallback secret.
 */
export interface JwtConfig {
  readonly secret: string;
  readonly expiresIn: string;
}

export function getJwtConfig(): JwtConfig {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. Generate a strong secret with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64url\'))"',
    );
  }
  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long to resist brute-force attacks.',
    );
  }
  const expiresIn = process.env['JWT_EXPIRES_IN'] ?? '15m';
  return { secret, expiresIn };
}
