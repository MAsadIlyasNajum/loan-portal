import { Module } from '@nestjs/common';
import { AuthModule } from '@org/auth';
import { DatabaseModule } from '@org/database';
import { LoansModule } from '@org/loans';
import { LoanPurposesModule } from '@org/loan-purposes';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    LoanPurposesModule,
    LoansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
