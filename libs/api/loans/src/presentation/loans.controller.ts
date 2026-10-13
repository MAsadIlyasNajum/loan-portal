import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@org/auth';
import type { AuthenticatedRequest } from '@org/auth';
import { LoansService } from '../application/loans.service';
import { LoanApplicationDto } from '../domain/loan-application.dto';
import { CreateLoanApplicationDto } from './dto/create-loan-application.dto';
import { ListLoanApplicationsQueryDto } from './dto/list-loan-applications.query-dto';

/**
 * Loan application endpoints.
 *
 * With the global `api` prefix these resolve to:
 *   POST /api/loans            submit an application
 *   GET  /api/loans            list applications
 *   GET  /api/loans/:id        application details
 *
 * All routes require authentication (JwtAuthGuard). The
 * authenticated principal determines the applicant and the
 * visible data; ownership and role permissions are enforced
 * in the service layer, never in the frontend.
 */
@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateLoanApplicationDto,
  ): Promise<LoanApplicationDto> {
    return this.loansService.createApplication(request.user, dto);
  }

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListLoanApplicationsQueryDto,
  ): Promise<LoanApplicationDto[]> {
    return this.loansService.listApplications(
      request.user,
      query.status,
    );
  }

  @Get(':id')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<LoanApplicationDto> {
    return this.loansService.getApplication(request.user, id);
  }
}
