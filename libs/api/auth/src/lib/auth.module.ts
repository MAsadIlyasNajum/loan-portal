import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '@org/database';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/controllers/auth.controller';
import {
  JWT_CONFIG,
  getJwtConfig,
} from './infrastructure/config/jwt.config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtStrategy } from './infrastructure/passport/jwt.strategy';
import { Argon2PasswordHasher } from './infrastructure/password/argon2.password-hasher';
import { PasswordHasher } from './infrastructure/password/password-hasher';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        // Validated here so a missing or weak secret fails
        // during module initialization, before the app
        // accepts traffic.
        const config = getJwtConfig();
        return {
          secret: config.secret,
          signOptions: {
            expiresIn: config.expiresIn as JwtSignOptions['expiresIn'],
            algorithm: 'HS256',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: JWT_CONFIG, useFactory: getJwtConfig },
    AuthService,
    JwtStrategy,
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
  ],
  exports: [AuthService],
})
export class AuthModule {}
