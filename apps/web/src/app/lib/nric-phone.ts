export function normalizeNric(value: string): string {
  return value.replace(/[\s-]/g, '');
}

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

export function isMalaysianNric(value: string): boolean {
  const nric = normalizeNric(value);
  if (!/^\d{12}$/.test(nric)) {
    return false;
  }
  const year = toFourDigitYear(Number(nric.slice(0, 2)));
  const month = Number(nric.slice(2, 4));
  const day = Number(nric.slice(4, 6));
  return isValidDate(year, month, day);
}

export function normalizePhone(value: string): string {
  const cleaned = value.replace(/[\s()-]/g, '');
  if (cleaned.startsWith('+60')) {
    return `0${cleaned.slice(3)}`;
  }
  if (cleaned.startsWith('60') && cleaned.length > 10) {
    return `0${cleaned.slice(2)}`;
  }
  return cleaned;
}

export function isMalaysianPhone(value: string): boolean {
  const phone = normalizePhone(value);
  return /^0(?:1[0-9]{8,9}|[2-9][0-9]{6,8})$/.test(phone);
}

export function isCurrency(value: string): boolean {
  if (value.trim() === '') return false;
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  const trimmed = value.replace(/^-/, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return false;
  return num > 0;
}
