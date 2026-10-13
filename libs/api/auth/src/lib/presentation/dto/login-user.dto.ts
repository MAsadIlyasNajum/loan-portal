import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Login input. The password is verified against the stored
 * Argon2id hash; the exact requirements applied at registration
 * are intentionally not re-enforced here so that a valid login
 * is never blocked by a later policy change.
 */
export class LoginUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'password must not be empty' })
  password!: string;
}
