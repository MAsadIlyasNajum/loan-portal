import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@org/auth';
import { LoanPurposesService } from '../application/loan-purposes.service';
import { LoanPurpose } from '../domain/loan-purpose';

/**
 * Loan purpose catalog endpoints.
 *
 * With the global `api` prefix this resolves to:
 *   GET /api/loan-purposes
 *
 * The list is served by the loan purposes service, which
 * caches the external banking system's response: only the
 * first request (or the first after the cache TTL expires)
 * pays the simulated 2-second round trip.
 */
@Controller('loan-purposes')
@UseGuards(JwtAuthGuard)
export class LoanPurposesController {
  constructor(private readonly loanPurposesService: LoanPurposesService) {}

  @Get()
  async list(): Promise<readonly LoanPurpose[]> {
    return this.loanPurposesService.getPurposes();
  }
}
