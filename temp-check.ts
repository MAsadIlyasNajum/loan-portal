import { PrismaService } from './libs/api/database/src/lib/prisma.service';

async function main() {
  const prisma = new PrismaService();
  try {
    const count = await prisma.loanPurpose.count();
    console.log(`Loan purpose count: ${count}`);
    if (count > 0) {
      const purposes = await prisma.loanPurpose.findMany();
      console.log('First purpose:', purposes[0]);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});