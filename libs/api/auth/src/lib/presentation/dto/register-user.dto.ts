import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

/**
 * Public registration input. Only email and password are
 * accepted; the role is always assigned server-side, so a
 * `role` property in the request body is rejected by the
 * global validation pipe (forbidNonWhitelisted) and can never
 * reach persistence.
 */
export class RegisterUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128, { message: 'password must be at most 128 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one digit',
  })
  password!: string;
}
