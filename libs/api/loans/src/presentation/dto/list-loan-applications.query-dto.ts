import { IsEnum, IsOptional } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

/**
 * Query parameters for listing loan applications. The status
 * filter is available to all callers, but customers only ever
 * receive their own applications regardless of the filter.
 */
export class ListLoanApplicationsQueryDto {
  @IsOptional()
  @IsEnum(ApplicationStatus, {
    message: 'status must be one of: PENDING, APPROVED, REJECTED, CANCELLED',
  })
  status?: ApplicationStatus;
}
