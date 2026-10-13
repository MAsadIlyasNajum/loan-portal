import {
  BadRequestException,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common';
import { CreateLoanApplicationDto } from './create-loan-application.dto';

describe('CreateLoanApplicationDto validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  function bodyMetadata(metatype: unknown): ArgumentMetadata {
    return {
      type: Body as unknown as ArgumentMetadata['type'],
      metatype: metatype as ArgumentMetadata['metatype'],
      data: 'dto',
    };
  }

  const validPayload = {
    fullName: 'John Doe',
    nric: '900101-14-5678',
    phone: '+6012-345-6789',
    email: '  John.Doe@Example.COM  ',
    monthlyIncome: 5000,
    loanAmount: 20000,
    tenureMonths: 24,
    purposeId: 'purpose-personal',
  };

  it('accepts a valid payload and normalizes identifiers', async () => {
    const result = await pipe.transform(
      { ...validPayload },
      bodyMetadata(CreateLoanApplicationDto),
    );

    expect(result).toBeInstanceOf(CreateLoanApplicationDto);
    expect(result.fullName).toBe('John Doe');
    expect(result.nric).toBe('900101145678');
    expect(result.phone).toBe('0123456789');
    expect(result.email).toBe('John.Doe@Example.COM');
    expect(result.monthlyIncome).toBe(5000);
    expect(result.loanAmount).toBe(20000);
    expect(result.tenureMonths).toBe(24);
    expect(result.purposeId).toBe('purpose-personal');
  });

  it('accepts numeric strings for amounts and tenure', async () => {
    const result = await pipe.transform(
      {
        ...validPayload,
        monthlyIncome: '5000.50',
        loanAmount: '20000',
        tenureMonths: '24',
      },
      bodyMetadata(CreateLoanApplicationDto),
    );

    expect(result.monthlyIncome).toBe(5000.5);
    expect(result.loanAmount).toBe(20000);
    expect(result.tenureMonths).toBe(24);
  });

  it('rejects a missing required field', async () => {
    const missingPurposeId: Record<string, unknown> = {
      ...validPayload,
    };
    delete missingPurposeId['purposeId'];
    await expect(
      pipe.transform(missingPurposeId, bodyMetadata(CreateLoanApplicationDto)),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty fullName', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, fullName: '   ' },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid NRIC (wrong length)', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, nric: '90010114567' },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an NRIC with an impossible date of birth', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, nric: '900231-14-5678' },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a foreign phone number', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, phone: '+1 555 010 1234' },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a malformed email', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, email: 'not-an-email' },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a non-positive monthly income', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, monthlyIncome: 0 },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a non-positive loan amount', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, loanAmount: -100 },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a fractional tenure', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, tenureMonths: 24.5 },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a tenure outside the allowed range', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, tenureMonths: 3 },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      pipe.transform(
        { ...validPayload, tenureMonths: 600 },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unexpected properties (mass-assignment protection)', async () => {
    await expect(
      pipe.transform(
        { ...validPayload, userId: 'other-user', status: 'APPROVED' },
        bodyMetadata(CreateLoanApplicationDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
