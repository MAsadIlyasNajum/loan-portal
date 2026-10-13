import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env['DATABASE_URL'] ?? 'mysql://loan_user:loan_password@localhost:3306/loan_portal?schema=public';
    const adapter = new PrismaMariaDb(databaseUrl);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }
    const models = Reflect.ownKeys(this).filter(
      (key): key is string => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
    );
    for (const model of models) {
      const modelDelegate = (this as Record<string, unknown>)[model];
      if (modelDelegate && typeof modelDelegate === 'object' && 'deleteMany' in modelDelegate && typeof modelDelegate.deleteMany === 'function') {
        await modelDelegate.deleteMany();
      }
    }
  }
}