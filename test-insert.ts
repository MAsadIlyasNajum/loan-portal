import { PrismaService } from './libs/api/database/src/lib/prisma.service';
import argon2 from 'argon2';

/**
 * Generates a random valid Malaysian NRIC (12 digits).
 * The NRIC is generated as YYMMDDBBSSSG where:
 *   YYMMDD: date of birth (valid date)
 *   BB: birthplace (two digits, 01-99)
 *   SSS: sequence number (three digits, 001-999)
 *   G: gender indicator (one digit, 0-9) - not validated
 */
function generateRandomNric(): string {
  let nric: string;
  do {
    // Generate a random date between 1950-01-01 and 2005-12-31
    const start = new Date(1950, 0, 1).getTime();
    const end = new Date(2005, 11, 31).getTime();
    const randomDate = new Date(start + Math.random() * (end - start));

    const year = randomDate.getFullYear();
    const month = randomDate.getMonth() + 1; // 1-12
    const day = randomDate.getDate(); // 1-31

    // Format as YYMMDD
    const yy = String(year % 100).padStart(2, '0'); // two-digit year
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');

    // Generate BB (01-99), SSS (001-999), G (0-9)
    const bb = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0'); // 1-99
    const sss = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0'); // 1-999
    const g = String(Math.floor(Math.random() * 10)); // 0-9

    nric = yy + mm + dd + bb + sss + g;
  } while (!isMalaysianNric(nric)); // Validate the date part (first 6 digits)

  return nric;
}

/**
 * Validates a Malaysian NRIC (MyKad) number.
 * Duplicate of the function from @org/loans/src/domain/nric to avoid import issues.
 */
function isMalaysianNric(nric: string): boolean {
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

/**
 * Generates a unique email for seeding.
 * Uses a counter to ensure uniqueness.
 */
let emailCounter = 0;
function generateSeedEmail(): string {
  emailCounter += 1;
  return `seed${emailCounter}@seed.loan-portal.test`;
}

/**
 * Generates a random password and returns its argon2 hash.
 */
async function hashRandomPassword(): Promise<string> {
  const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return await argon2.hash(randomPassword);
}

async function main() {
  const prisma = new PrismaService();
  try {
    const email = generateSeedEmail();
    const passwordHash = await hashRandomPassword();
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'CUSTOMER',
      },
    });
    console.log('Created user:', user.id);

    // Get a purpose
    const purposes = await prisma.loanPurpose.findMany();
    const purpose = purposes[0];

    const nric = generateRandomNric();
    const loanApplication = await prisma.loanApplication.create({
      data: {
        fullName: 'Test Applicant',
        nric,
        phone: '0123456789',
        email,
        monthlyIncome: 5000,
        requestedAmount: 10000,
        tenureMonths: 12,
        purposeId: purpose.id,
        userId: user.id,
      },
    });
    console.log('Created loan application:', loanApplication.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();