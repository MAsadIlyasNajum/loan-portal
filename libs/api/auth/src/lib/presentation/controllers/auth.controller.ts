import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService, LoginResult } from '../../application/auth.service';
import { AuthenticatedUser } from '../../domain/authenticated-user';
import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterUserDto } from '../dto/register-user.dto';

/**
 * Authentication endpoints. The controller only validates input
 * through the DTOs and delegates to the authentication service;
 * it contains no hashing, queries or authorization rules.
 *
 * With the global `api` prefix these resolve to:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *
 * Both routes are public by design; protected routes opt in
 * explicitly with JwtAuthGuard.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterUserDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }
}
