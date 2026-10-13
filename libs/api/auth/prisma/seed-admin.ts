/**
 * Provisions the local development Admin account.
 *
 * This script is the only supported way to create an Admin and is
 * never executed during API startup. It is safe to rerun:
 *
 * - If no account exists for the normalized bootstrap email, a new
 *   ADMIN account is created with an Argon2id password hash.
 * - If the account already exists as ADMIN, nothing is changed and
 *   the existing password is left untouched.
 * - If the account exists as CUSTOMER, the script refuses to run:
 *   silently elevating a customer to Admin is an explicit
 *   administrative decision and must not happen accidentally.
 *
 * Required environment variables:
 *   ADMIN_BOOTSTRAP_EMAIL    bootstrap email address
 *   ADMIN_BOOTSTRAP_PASSWORD bootstrap password (never committed)
 *
 * The script prints neither the password nor the password hash.
 *
 * Usage:
 *   nx run auth:seed:admin
 */
import { PrismaService } from '@org/database';
import { Argon2PasswordHasher } from '../src/lib/infrastructure/password/argon2.password-hasher';
import { normalizeEmail } from '../src/lib/domain/email';
import { UserRole } from '../src/lib/domain/user-role';

async function main(): Promise<void> {
  const bootstrapEmail = process.env['ADMIN_BOOTSTRAP_EMAIL'];
  const bootstrapPassword = process.env['ADMIN_BOOTSTRAP_PASSWORD'];

  if (!bootstrapEmail || !bootstrapPassword) {
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD environment variables are required. ' +
        'See .env.example for the expected configuration.',
    );
  }

  const email = normalizeEmail(bootstrapEmail);
  const prisma = new PrismaService();
  const passwordHasher = new Argon2PasswordHasher();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role === UserRole.ADMIN) {
        console.log(
          `Admin account already exists for ${email}. No changes made.`,
        );
        return;
      }
      throw new Error(
        `An existing CUSTOMER account is registered for ${email}. ` +
          'Refusing to elevate it to ADMIN automatically. Promote the ' +
          'account explicitly with a database statement if this is an ' +
          'intended administrative decision.',
      );
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: await passwordHasher.hash(bootstrapPassword),
        role: UserRole.ADMIN,
      },
    });

    console.log(`Admin account provisioned for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
