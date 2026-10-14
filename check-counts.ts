import { PrismaService } from './libs/api/database/src/lib/prisma.service';

async function main() {
  const prisma = new PrismaService();
  try {
    const userCount = await prisma.user.count();
    const loanCount = await prisma.loanApplication.count();
    console.log('User count:', userCount);
    console.log('Loan application count:', loanCount);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});