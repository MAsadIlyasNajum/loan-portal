import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Malaysian telephone number validation and normalization.
 *
 * Accepted numbers are Malaysian mobile numbers
 * (`01x-xxx-xxxx`, 10–11 digits) and landlines (area code
 * `02`–`09x` plus a subscriber number, 8–10 digits total),
 * with or without the `+60`/`60` country code and with
 * spaces, hyphens or parentheses as separators. The normalized
 * (stored) form is the local number with a leading `0`.
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s()-]/g, '');
  if (cleaned.startsWith('+60')) {
    return `0${cleaned.slice(3)}`;
  }
  if (cleaned.startsWith('60') && cleaned.length > 10) {
    return `0${cleaned.slice(2)}`;
  }
  return cleaned;
}

export function isMalaysianPhone(phone: string): boolean {
  return /^0(?:1[0-9]{8,9}|[2-9][0-9]{6,8})$/.test(phone);
}

@ValidatorConstraint({ name: 'isMalaysianPhone', async: false })
class IsMalaysianPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isMalaysianPhone(value);
  }

  defaultMessage(): string {
    return 'phone must be a valid Malaysian mobile or landline number';
  }
}

/**
 * Validates a Malaysian mobile or landline number. Apply it
 * after a normalization transform so local numbers and numbers
 * with a `+60` country code are both accepted.
 */
export function IsMalaysianPhone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyKey: string | symbol) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyKey as string,
      constraints: [],
      options: validationOptions,
      validator: IsMalaysianPhoneConstraint,
    });
  };
}
