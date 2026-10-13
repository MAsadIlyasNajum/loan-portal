import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsMalaysianNric, normalizeNric } from '../../domain/nric';
import {
  IsMalaysianPhone,
  normalizePhone,
} from '../../domain/phone';

/**
 * Loan application submission input. Every field is required
 * and format-validated on the backend:
 *
 * - `nric` accepts the plain 12-digit and the hyphenated
 *   Malaysian NRIC form and is normalized to 12 digits;
 * - `phone` accepts Malaysian mobile and landline numbers,
 *   with or without the `+60` country code, and is
 *   normalized to the local form;
 * - `monthlyIncome` and `loanAmount` are RM amounts with at
 *   most 2 decimal places;
 * - `tenureMonths` is a whole number of months between 6
 *   and 360;
 * - `purposeId` must reference an active purpose from the
 *   external banking system's catalog (validated by the
 *   service, which also rejects inactive purposes).
 *
 * The applicant is the authenticated user and the status is
 * always PENDING; neither can be influenced by the request
 * body (unknown properties are rejected by the global
 * validation pipe).
 */
export class CreateLoanApplicationDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'fullName must not be empty' })
  @MaxLength(255, { message: 'fullName must be at most 255 characters' })
  fullName!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeNric(value) : value,
  )
  @IsString()
  @IsMalaysianNric()
  nric!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizePhone(value) : value,
  )
  @IsString()
  @IsMalaysianPhone()
  phone!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'monthlyIncome must be a number with at most 2 decimal places' },
  )
  @Min(0.01, { message: 'monthlyIncome must be greater than 0' })
  monthlyIncome!: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'loanAmount must be a number with at most 2 decimal places' },
  )
  @Min(1, { message: 'loanAmount must be at least 1' })
  loanAmount!: number;

  @Type(() => Number)
  @IsInt({ message: 'tenureMonths must be a whole number of months' })
  @Min(6, { message: 'tenureMonths must be at least 6 months' })
  @Max(360, { message: 'tenureMonths must be at most 360 months' })
  tenureMonths!: number;

  @IsString()
  @IsNotEmpty({ message: 'purposeId must not be empty' })
  purposeId!: string;
}
