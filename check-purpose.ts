import { PrismaService } from './libs/api/database/src/lib/prisma.service';

async function main() {
  const prisma = new PrismaService();
  try {
    const purposes = await prisma.loanPurpose.findMany();
    console.log('Purposes:', purposes);
    if (purposes.length === 0) {
      const purpose = await prisma.loanPurpose.create({
        data: {
          code: 'TEST',
          name: 'Test Purpose',
          description: 'Test',
          isActive: true,
        },
      });
      console.log('Created purpose:', purpose.id);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();