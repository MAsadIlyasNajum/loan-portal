/**
 * Seeds the development database with loan applications for testing.
 *
 * This script creates:
 *   - Loan purposes (if none exist)
 *   - User (customer) records with unique emails and argon2 password hashes
 *   - Loan application records with unique, valid NRICs
 *
 * It is safe to rerun:
 *   - If a user with the generated email exists, it is reused.
 *   - If a loan application with the generated NRIC exists, it is skipped.
 *
 * Required environment variables:
 *   None (uses the default DATABASE_URL from .env)
 *
 * Usage:
 *   ts-node libs/api/database/prisma/seed-loans.ts
 */

import { PrismaService } from '../src/lib/prisma.service';
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

async function main(): Promise<void> {
  const prisma = new PrismaService();
  const batchSize = 500;
  const targetLoanApplications = 10000;
  let createdLoanApplications = 0;

  try {
    // Step 1: Ensure loan purposes exist
    console.log('Checking loan purposes...');
    let purposes = await prisma.loanPurpose.findMany();
    if (purposes.length === 0) {
      console.log('No loan purposes found. Creating default purposes...');
      const purposeData = [
        { code: 'HOME', name: 'Home Purchase', description: 'Purchase of residential property', isActive: true },
        { code: 'CAR', name: 'Vehicle Loan', description: 'Purchase of a motor vehicle', isActive: true },
        { code: 'EDUCATION', name: 'Education Loan', description: 'Funding for educational expenses', isActive: true },
        { code: 'PERSONAL', name: 'Personal Loan', description: 'General purpose personal loan', isActive: true },
        { code: 'OTHER', name: 'Other', description: 'Other purposes', isActive: true },
      ];
      await prisma.loanPurpose.createMany({
        data: purposeData,
      });
      // Fetch the created purposes
      purposes = await prisma.loanPurpose.findMany();
      console.log(`Created ${purposes.length} loan purposes.`);
    } else {
      console.log(`Found ${purposes.length} existing loan purposes.`);
    }

    // We'll create users and loan applications in batches.
    // We'll keep a map of email to userId to avoid duplicate user creation within this script run.
    const emailToUserId: Map<string, string> = new Map();

    while (createdLoanApplications < targetLoanApplications) {
      const spotsLeft = targetLoanApplications - createdLoanApplications;
      const currentBatchSize = Math.min(batchSize, spotsLeft);

      // Generate batch of emails and NRICs
      const batchEmails: string[] = [];
      const batchNrics: string[] = [];
      for (let i = 0; i < currentBatchSize; i++) {
        batchEmails.push(generateSeedEmail());
        batchNrics.push(generateRandomNric());
      }

      // Find existing users for these emails
      const existingUsers = await prisma.user.findMany({
        where: {
          email: {
            in: batchEmails,
          },
        },
        select: {
          id: true,
          email: true,
        },
      });
      // Fill the emailToUserId map with existing users
      for (const user of existingUsers) {
        emailToUserId.set(user.email, user.id);
      }

      // Determine which emails need new users
      const emailsToCreate = batchEmails.filter(email => !emailToUserId.has(email));
      let usersCreated = 0;
      if (emailsToCreate.length > 0) {
        // Hash passwords for new users
        const passwordHashes = await Promise.all(emailsToCreate.map(hashRandomPassword));
        // Create new users
        await prisma.user.createMany({
          data: emailsToCreate.map((email, index) => ({
            email,
            passwordHash: passwordHashes[index],
            role: 'CUSTOMER',
          })),
        });
        // Fetch the newly created users to get their IDs
        const newUsers = await prisma.user.findMany({
          where: {
            email: {
              in: emailsToCreate,
            },
          },
          select: {
            id: true,
            email: true,
          },
        });
        for (const user of newUsers) {
          emailToUserId.set(user.email, user.id);
        }
        usersCreated = newUsers.length;
        console.log(`Created ${usersCreated} new users.`);
      }

      // Now we have userIds for all emails in batchEmails (either existing or just created)
      // Prepare loan application data
      const loanApplicationsToCreate = [];
      for (let i = 0; i < currentBatchSize; i++) {
        const email = batchEmails[i];
        const nric = batchNrics[i];
        const userId = emailToUserId.get(email);
        if (!userId) {
          console.error(`User not found for email: ${email}`);
          continue;
        }
        // Pick a random purpose from the purposes array
        const purpose = purposes[Math.floor(Math.random() * purposes.length)];

        loanApplicationsToCreate.push({
          fullName: `Applicant ${email.split('@')[0]}`, // e.g., Applicant seed123
          nric,
          phone: '0123456789', // placeholder phone number
          email,
          monthlyIncome: parseFloat((5000 + Math.random() * 10000).toFixed(2)), // RM 5k-15k, 2 decimal places
          requestedAmount: parseFloat((10000 + Math.random() * 90000).toFixed(2)), // RM 10k-100k, 2 decimal places
          tenureMonths: 12 + Math.floor(Math.random() * 359), // 12-360 months
          purposeId: purpose.id,
          userId,
          // status defaults to PENDING
        });
      }

      // Create loan applications, skipping duplicates based on NRIC
      // Check which NRICs already exist in the database
      const existingNrics = await prisma.loanApplication.findMany({
        where: {
          nric: {
            in: batchNrics,
          },
        },
        select: {
          nric: true,
        },
      });
      const existingNricSet = new Set(existingNrics.map(ap => ap.nric));

      const toCreate = loanApplicationsToCreate.filter(app => !existingNricSet.has(app.nric));

      if (toCreate.length > 0) {
        await prisma.loanApplication.createMany({
          data: toCreate,
        });
        createdLoanApplications += toCreate.length;
        console.log(`Created ${toCreate.length} loan applications. Total: ${createdLoanApplications}`);
      } else {
        console.log('All loan applications in this batch already existed (based on NRIC). Skipping.');
      }
    }

    console.log(`Seeding completed. Total loan applications created: ${createdLoanApplications}`);
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
main()
  .then(() => {
    console.log('Seed script finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });