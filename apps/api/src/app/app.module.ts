import { Module } from '@nestjs/common';
import { AuthModule } from '@org/auth';
import { DatabaseModule } from '@org/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
