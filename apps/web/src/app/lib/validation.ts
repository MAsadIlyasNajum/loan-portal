export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface Validation<T> {
  readonly valid: boolean;
  readonly errors: Partial<Record<keyof T, string>>;
}

export function validate<T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T, (value: unknown, all: T) => string | undefined>>,
): Validation<T> {
  const errors: Partial<Record<keyof T, string>> = {};
  let valid = true;
  for (const key of Object.keys(rules) as (keyof T)[]) {
    const rule = rules[key];
    if (!rule) continue;
    const message = rule(values[key], values);
    if (message) {
      errors[key] = message;
      valid = false;
    }
  }
  return { valid, errors };
}
