import { isMalaysianNric, normalizeNric } from './nric';

describe('normalizeNric', () => {
  it('strips hyphens from the formatted form', () => {
    expect(normalizeNric('900101-14-5678')).toBe('900101145678');
  });

  it('strips whitespace', () => {
    expect(normalizeNric(' 90 01 01 14 56 78 ')).toBe('900101145678');
  });

  it('leaves the plain 12-digit form unchanged', () => {
    expect(normalizeNric('900101145678')).toBe('900101145678');
  });
});

describe('isMalaysianNric', () => {
  it('accepts a valid 12-digit NRIC', () => {
    expect(isMalaysianNric('900101145678')).toBe(true);
  });

  it('accepts the hyphenated form once normalized', () => {
    expect(isMalaysianNric(normalizeNric('900101-14-5678'))).toBe(true);
  });

  it('rejects numbers that are not exactly 12 digits', () => {
    expect(isMalaysianNric('90010114567')).toBe(false);
    expect(isMalaysianNric('9001011456789')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(isMalaysianNric('90010114567A')).toBe(false);
    expect(isMalaysianNric('')).toBe(false);
  });

  it('rejects an impossible date of birth (31 February)', () => {
    expect(isMalaysianNric('900231145678')).toBe(false);
  });

  it('rejects an invalid month', () => {
    expect(isMalaysianNric('901301145678')).toBe(false);
  });

  it('rejects day zero', () => {
    expect(isMalaysianNric('900100145678')).toBe(false);
  });

  it('accepts a leap day in a leap year', () => {
    // 1992-02-29
    expect(isMalaysianNric('920229145678')).toBe(true);
  });

  it('rejects a leap day in a non-leap year', () => {
    // 1991-02-29
    expect(isMalaysianNric('910229145678')).toBe(false);
  });
});
