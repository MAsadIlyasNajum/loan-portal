/**
 * Normalizes an email address for persistence and lookup.
 *
 * Policy: surrounding whitespace is trimmed and the address is lowercased
 * before it is stored or used as a lookup key. Registration and login apply
 * the identical normalization, so an address can only have one stored form
 * and the database's unique constraint on `users.email` is the single
 * source of uniqueness truth.
 *
 * Limitations (documented intentionally):
 * - `toLowerCase()` performs Unicode default case folding; it does not apply
 *   locale-specific mappings (e.g. Turkish dotted/dotless "I").
 * - Provider-specific aliasing (Gmail "+" suffixes or dots, for example) is
 *   not normalized; those remain distinct addresses.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
