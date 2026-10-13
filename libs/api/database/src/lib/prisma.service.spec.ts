import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;
  let module: TestingModule;

  beforeEach(async () => {
    process.env['DATABASE_URL'] = 'mysql://loan_user:loan_password@localhost:3306/loan_portal?schema=public';
    
    module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    await service.$disconnect();
    await module.close();
    delete process.env['DATABASE_URL'];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extend PrismaClient', () => {
    expect(service.user).toBeDefined();
    expect(service.loanPurpose).toBeDefined();
    expect(service.loanApplication).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to database', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from database', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('cleanDatabase', () => {
    it('should throw in production environment', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      try {
        await expect(service.cleanDatabase()).rejects.toThrow('cleanDatabase is not allowed in production');
      } finally {
        process.env['NODE_ENV'] = originalEnv;
      }
    });

    it('should not throw in non-production environment', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'test';

      try {
        await expect(service.cleanDatabase()).resolves.not.toThrow();
      } finally {
        process.env['NODE_ENV'] = originalEnv;
      }
    });
  });
});