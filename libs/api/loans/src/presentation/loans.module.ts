import { Module } from '@nestjs/common';
import { LoanPurposesModule } from '@org/loan-purposes';
import { LoansService } from '../application/loans.service';
import { LoansController } from './loans.controller';

@Module({
  imports: [LoanPurposesModule],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
