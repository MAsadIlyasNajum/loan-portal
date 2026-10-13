import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Malaysian NRIC (MyKad) validation and normalization.
 *
 * A MyKad number is 12 digits laid out as `YYMMDD-PB-###G`:
 * the first six digits encode the holder's date of birth, the
 * next two are the birthplace code, the next three are a
 * sequence number and the final digit encodes gender. Both the
 * plain 12-digit form and the hyphenated form are accepted;
 * the normalized (stored) form is always the plain 12 digits.
 */
export function normalizeNric(nric: string): string {
  return nric.replace(/[\s-]/g, '');
}

export function isMalaysianNric(nric: string): boolean {
  if (!/^\d{12}$/.test(nric)) {
    return false;
  }
  const year = toFourDigitYear(Number(nric.slice(0, 2)));
  const month = Number(nric.slice(2, 4));
  const day = Number(nric.slice(4, 6));
  return isValidDate(year, month, day);
}

// Two-digit years 00–49 belong to the 2000s, 50–99 to the 1900s.
function toFourDigitYear(twoDigitYear: number): number {
  return twoDigitYear > 49 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

@ValidatorConstraint({ name: 'isMalaysianNric', async: false })
class IsMalaysianNricConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isMalaysianNric(value);
  }

  defaultMessage(): string {
    return 'nric must be a valid Malaysian NRIC (12 digits with a valid date of birth)';
  }
}

/**
 * Validates a Malaysian NRIC (MyKad) number. Apply it after a
 * normalization transform so both the plain 12-digit and the
 * hyphenated forms are accepted.
 */
export function IsMalaysianNric(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyKey: string | symbol) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyKey as string,
      constraints: [],
      options: validationOptions,
      validator: IsMalaysianNricConstraint,
    });
  };
}
