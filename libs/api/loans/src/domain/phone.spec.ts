import { isMalaysianPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('strips hyphens, spaces and parentheses', () => {
    expect(normalizePhone('012-345-6789')).toBe('0123456789');
    expect(normalizePhone('(012) 345 6789')).toBe('0123456789');
  });

  it('converts the +60 country code to the local form', () => {
    expect(normalizePhone('+6012-345-6789')).toBe('0123456789');
  });

  it('converts the 60 country code to the local form', () => {
    expect(normalizePhone('60123456789')).toBe('0123456789');
  });

  it('keeps local numbers unchanged', () => {
    expect(normalizePhone('032345678')).toBe('032345678');
  });
});

describe('isMalaysianPhone', () => {
  it('accepts a 10-digit mobile number', () => {
    expect(isMalaysianPhone('0123456789')).toBe(true);
  });

  it('accepts an 11-digit mobile number', () => {
    expect(isMalaysianPhone('01123456789')).toBe(true);
  });

  it('accepts landline numbers', () => {
    expect(isMalaysianPhone('032345678')).toBe(true);
    expect(isMalaysianPhone('0822345678')).toBe(true);
  });

  it('accepts a number after normalization', () => {
    expect(isMalaysianPhone(normalizePhone('+6012-345-6789'))).toBe(true);
  });

  it('rejects a number without the leading zero', () => {
    expect(isMalaysianPhone('123456789')).toBe(false);
  });

  it('rejects a 9-digit mobile number', () => {
    expect(isMalaysianPhone('012345678')).toBe(false);
  });

  it('rejects numbers that are too long', () => {
    expect(isMalaysianPhone('012345678901')).toBe(false);
  });

  it('rejects numbers that are too short', () => {
    expect(isMalaysianPhone('0323456')).toBe(false);
  });
});
