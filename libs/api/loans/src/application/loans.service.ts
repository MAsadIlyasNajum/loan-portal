import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  LoanApplication as LoanApplicationEntity,
  Prisma,
} from '@prisma/client';
import {
  AuthenticatedUser,
  normalizeEmail,
  UserRole,
} from '@org/auth';
import { PrismaService } from '@org/database';
import { LoanPurposesService } from '@org/loan-purposes';
import { LoanApplicationDto } from '../domain/loan-application.dto';
import { normalizeNric } from '../domain/nric';
import { normalizePhone } from '../domain/phone';
import { CreateLoanApplicationDto } from '../presentation/dto/create-loan-application.dto';

/**
 * Loan application use cases.
 *
 * Authorization is enforced here, at the service layer, so
 * it never depends on frontend restrictions:
 *
 * - new applications are always owned by the authenticated
 *   user and always start as PENDING;
 * - customers only ever see their own applications;
 * - admins see all customers' applications, optionally
 *   filtered by status.
 */
@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanPurposes: LoanPurposesService,
  ) {}

  /**
   * Submits a new loan application for the authenticated
   * customer. The applicant is taken from the authenticated
   * principal (never from the request body), the status is
   * always PENDING, and the requested purpose must exist in
   * the external banking system's catalog and be active.
   */
  async createApplication(
    user: AuthenticatedUser,
    dto: CreateLoanApplicationDto,
  ): Promise<LoanApplicationDto> {
    const purpose = await this.loanPurposes.findPurposeById(
      dto.purposeId,
    );
    if (!purpose) {
      throw new BadRequestException(
        'The selected loan purpose does not exist.',
      );
    }
    if (!purpose.isActive) {
      throw new BadRequestException(
        'The selected loan purpose is no longer available.',
      );
    }

    try {
      const application = await this.prisma.loanApplication.create({
        data: {
          fullName: dto.fullName.trim(),
          nric: normalizeNric(dto.nric),
          phone: normalizePhone(dto.phone),
          email: normalizeEmail(dto.email),
          monthlyIncome: dto.monthlyIncome,
          requestedAmount: dto.loanAmount,
          tenureMonths: dto.tenureMonths,
          purposeId: purpose.id,
          // The applicant comes from the authenticated
          // principal; a request body can never assign an
          // application to another user.
          userId: user.id,
          status: ApplicationStatus.PENDING,
        },
      });
      return toDto(application);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // NRIC is unique: one application per NRIC.
        throw new ConflictException(
          'An application with this NRIC already exists.',
        );
      }
      throw error;
    }
  }

  /**
   * Lists loan applications. Customers only ever receive
   * their own applications; admins receive all customers'
   * applications, optionally filtered by status.
   */
  async listApplications(
    user: AuthenticatedUser,
    status?: ApplicationStatus,
  ): Promise<LoanApplicationDto[]> {
    const isAdmin = user.role === UserRole.ADMIN;
    const where = isAdmin
      ? status
        ? { status }
        : {}
      : status
        ? { userId: user.id, status }
        : { userId: user.id };

    const applications = await this.prisma.loanApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return applications.map(toDto);
  }

  /**
   * Returns a single loan application. Customers can only
   * retrieve their own applications; admins can retrieve any.
   * A customer requesting another user's application receives
   * the same 404 as a nonexistent id, so the existence of
   * other users' applications is never disclosed.
   */
  async getApplication(
    user: AuthenticatedUser,
    id: string,
  ): Promise<LoanApplicationDto> {
    const application =
      await this.prisma.loanApplication.findUnique({ where: { id } });

    if (!application) {
      throw new NotFoundException('Loan application not found.');
    }

    if (
      user.role !== UserRole.ADMIN &&
      application.userId !== user.id
    ) {
      throw new NotFoundException('Loan application not found.');
    }

    return toDto(application);
  }
}

function toDto(
  application: LoanApplicationEntity,
): LoanApplicationDto {
  return {
    id: application.id,
    fullName: application.fullName,
    nric: application.nric,
    phone: application.phone,
    email: application.email,
    monthlyIncome: Number(application.monthlyIncome),
    requestedAmount: Number(application.requestedAmount),
    tenureMonths: application.tenureMonths,
    purposeId: application.purposeId,
    status: application.status,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}
