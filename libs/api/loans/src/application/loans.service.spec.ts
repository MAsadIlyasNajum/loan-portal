import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser, UserRole } from '@org/auth';
import type { LoanPurposesService } from '@org/loan-purposes';
import type { PrismaService } from '@org/database';
import { LoansService } from './loans.service';
import { CreateLoanApplicationDto } from '../presentation/dto/create-loan-application.dto';

const CUSTOMER: AuthenticatedUser = {
  id: 'customer-1',
  email: 'customer@example.com',
  role: UserRole.CUSTOMER,
};

const OTHER_CUSTOMER: AuthenticatedUser = {
  id: 'customer-2',
  email: 'other@example.com',
  role: UserRole.CUSTOMER,
};

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

const ACTIVE_PURPOSE = {
  id: 'purpose-personal',
  code: 'PERSONAL',
  name: 'Personal',
  description: 'General personal expenses',
  isActive: true,
};

const INACTIVE_PURPOSE = {
  id: 'purpose-legacy',
  code: 'LEGACY',
  name: 'Legacy',
  description: 'No longer offered',
  isActive: false,
};

function createDto(
  overrides: Partial<CreateLoanApplicationDto> = {},
): CreateLoanApplicationDto {
  return {
    fullName: 'John Doe',
    nric: '900101145678',
    phone: '0123456789',
    email: 'john@example.com',
    monthlyIncome: 5000,
    loanAmount: 20000,
    tenureMonths: 24,
    purposeId: ACTIVE_PURPOSE.id,
    ...overrides,
  };
}

function createApplication(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'application-1',
    fullName: 'John Doe',
    nric: '900101145678',
    phone: '0123456789',
    email: 'john@example.com',
    monthlyIncome: new Prisma.Decimal(5000),
    requestedAmount: new Prisma.Decimal(20000),
    tenureMonths: 24,
    purposeId: ACTIVE_PURPOSE.id,
    userId: CUSTOMER.id,
    status: ApplicationStatus.PENDING,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaClientKnownError(code: string): Error {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the constraint: loan_applications_nric_key',
    { code, clientVersion: '7.10.0', meta: { target: ['nric'] } },
  );
}

describe('LoansService', () => {
  const prisma = {
    loanApplication: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const loanPurposes = {
    findPurposeById: jest.fn(),
  };
  let service: LoansService;

  beforeEach(() => {
    jest.clearAllMocks();
    loanPurposes.findPurposeById.mockResolvedValue(ACTIVE_PURPOSE);
    service = new LoansService(
      prisma as unknown as PrismaService,
      loanPurposes as unknown as LoanPurposesService,
    );
  });

  describe('createApplication', () => {
    it('creates a PENDING application owned by the authenticated user', async () => {
      prisma.loanApplication.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          createApplication({ ...data, id: 'application-1' }),
      );

      const result = await service.createApplication(
        CUSTOMER,
        createDto(),
      );

      expect(prisma.loanApplication.create).toHaveBeenCalledWith({
        data: {
          fullName: 'John Doe',
          nric: '900101145678',
          phone: '0123456789',
          email: 'john@example.com',
          monthlyIncome: 5000,
          requestedAmount: 20000,
          tenureMonths: 24,
          purposeId: ACTIVE_PURPOSE.id,
          userId: CUSTOMER.id,
          status: ApplicationStatus.PENDING,
        },
      });
      expect(result.status).toBe(ApplicationStatus.PENDING);
      expect(result.monthlyIncome).toBe(5000);
      expect(result.requestedAmount).toBe(20000);
    });

    it('normalizes the NRIC, phone and email before persistence', async () => {
      prisma.loanApplication.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          createApplication({ ...data, id: 'application-1' }),
      );

      await service.createApplication(
        CUSTOMER,
        createDto({
          nric: '900101-14-5678',
          phone: '+6012-345-6789',
          email: '  John.Doe@Example.COM ',
        }),
      );

      const persisted = (
        prisma.loanApplication.create as jest.Mock
      ).mock.calls[0][0].data;
      expect(persisted.nric).toBe('900101145678');
      expect(persisted.phone).toBe('0123456789');
      expect(persisted.email).toBe('john.doe@example.com');
    });

    it('rejects an unknown purpose with a 400', async () => {
      loanPurposes.findPurposeById.mockResolvedValue(null);

      await expect(
        service.createApplication(CUSTOMER, createDto()),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.loanApplication.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive purpose with a 400', async () => {
      loanPurposes.findPurposeById.mockResolvedValue(INACTIVE_PURPOSE);

      await expect(
        service.createApplication(CUSTOMER, createDto()),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.loanApplication.create).not.toHaveBeenCalled();
    });

    it('maps a duplicate NRIC to a 409 Conflict', async () => {
      prisma.loanApplication.create.mockRejectedValue(
        createPrismaClientKnownError('P2002'),
      );

      await expect(
        service.createApplication(CUSTOMER, createDto()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('surfaces non-unique Prisma errors instead of hiding them', async () => {
      prisma.loanApplication.create.mockRejectedValue(
        createPrismaClientKnownError('P2001'),
      );

      await expect(
        service.createApplication(CUSTOMER, createDto()),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });

    it('never persists an applicant other than the authenticated user', async () => {
      prisma.loanApplication.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          createApplication({ ...data, id: 'application-1' }),
      );

      // The DTO exposes no userId/status properties, so the
      // persisted owner and status are always the server-side
      // values, whatever the request body contained.
      const dto = {
        ...createDto(),
        userId: OTHER_CUSTOMER.id,
        status: ApplicationStatus.APPROVED,
      } as CreateLoanApplicationDto;

      await service.createApplication(CUSTOMER, dto);

      const persisted = (
        prisma.loanApplication.create as jest.Mock
      ).mock.calls[0][0].data;
      expect(persisted.userId).toBe(CUSTOMER.id);
      expect(persisted.status).toBe(ApplicationStatus.PENDING);
    });
  });

  describe('listApplications', () => {
    it('returns only the customer\'s own applications', async () => {
      prisma.loanApplication.findMany.mockResolvedValue([
        createApplication(),
      ]);

      const result = await service.listApplications(CUSTOMER);

      expect(prisma.loanApplication.findMany).toHaveBeenCalledWith({
        where: { userId: CUSTOMER.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('application-1');
    });

    it('filters the customer\'s own applications by status', async () => {
      prisma.loanApplication.findMany.mockResolvedValue([]);

      await service.listApplications(
        CUSTOMER,
        ApplicationStatus.PENDING,
      );

      expect(prisma.loanApplication.findMany).toHaveBeenCalledWith({
        where: {
          userId: CUSTOMER.id,
          status: ApplicationStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns all customers\' applications for an admin', async () => {
      prisma.loanApplication.findMany.mockResolvedValue([
        createApplication({ userId: OTHER_CUSTOMER.id }),
        createApplication({ id: 'application-2', userId: CUSTOMER.id }),
      ]);

      const result = await service.listApplications(ADMIN);

      expect(prisma.loanApplication.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('filters all customers\' applications by status for an admin', async () => {
      prisma.loanApplication.findMany.mockResolvedValue([]);

      await service.listApplications(
        ADMIN,
        ApplicationStatus.APPROVED,
      );

      expect(prisma.loanApplication.findMany).toHaveBeenCalledWith({
        where: { status: ApplicationStatus.APPROVED },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('converts Decimal amounts to JSON-safe numbers', async () => {
      prisma.loanApplication.findMany.mockResolvedValue([
        createApplication(),
      ]);

      const [result] = await service.listApplications(CUSTOMER);

      expect(typeof result.monthlyIncome).toBe('number');
      expect(typeof result.requestedAmount).toBe('number');
      expect(result.monthlyIncome).toBe(5000);
      expect(result.requestedAmount).toBe(20000);
    });
  });

  describe('getApplication', () => {
    it('returns the customer\'s own application', async () => {
      prisma.loanApplication.findUnique.mockResolvedValue(
        createApplication(),
      );

      const result = await service.getApplication(
        CUSTOMER,
        'application-1',
      );

      expect(prisma.loanApplication.findUnique).toHaveBeenCalledWith({
        where: { id: 'application-1' },
      });
      expect(result.id).toBe('application-1');
    });

    it('returns any application for an admin', async () => {
      prisma.loanApplication.findUnique.mockResolvedValue(
        createApplication({ userId: OTHER_CUSTOMER.id }),
      );

      const result = await service.getApplication(
        ADMIN,
        'application-1',
      );

      expect(result.id).toBe('application-1');
    });

    it('rejects a customer reading another user\'s application with a 404', async () => {
      prisma.loanApplication.findUnique.mockResolvedValue(
        createApplication({ userId: OTHER_CUSTOMER.id }),
      );

      await expect(
        service.getApplication(CUSTOMER, 'application-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an unknown application with a 404', async () => {
      prisma.loanApplication.findUnique.mockResolvedValue(null);

      await expect(
        service.getApplication(CUSTOMER, 'unknown'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not disclose another user\'s application to a customer (same 404 as a missing id)', async () => {
      prisma.loanApplication.findUnique.mockResolvedValue(
        createApplication({ userId: OTHER_CUSTOMER.id }),
      );

      const foreignError = (await service
        .getApplication(CUSTOMER, 'application-1')
        .catch((error: Error) => error)) as Error;
      prisma.loanApplication.findUnique.mockResolvedValue(null);
      const missingError = (await service
        .getApplication(CUSTOMER, 'application-1')
        .catch((error: Error) => error)) as Error;

      expect(foreignError).toBeInstanceOf(NotFoundException);
      expect(foreignError.message).toBe(missingError.message);
    });
  });
});
