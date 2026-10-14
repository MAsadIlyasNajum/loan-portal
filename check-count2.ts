import { PrismaService } from './libs/api/database/src/lib/prisma.service';

async function main() {
  const prisma = new PrismaService();
  try {
    const count = await prisma.$queryRaw`SELECT COUNT(*) FROM loan_applications`;
    console.log('Loan application count:', count);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});