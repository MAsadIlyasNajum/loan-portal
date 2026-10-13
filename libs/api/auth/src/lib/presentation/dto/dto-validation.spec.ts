import { BadRequestException, Body, ValidationPipe } from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common';
import { LoginUserDto } from './login-user.dto';
import { RegisterUserDto } from './register-user.dto';

describe('Auth DTO validation', () => {
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

  describe('RegisterUserDto', () => {
    it('accepts a valid email and password', async () => {
      const result = await pipe.transform(
        { email: 'user@example.com', password: 'password123' },
        bodyMetadata(RegisterUserDto),
      );
      expect(result).toBeInstanceOf(RegisterUserDto);
      expect(result.email).toBe('user@example.com');
    });

    it('trims surrounding whitespace from the email', async () => {
      const result = await pipe.transform(
        { email: '  user@example.com  ', password: 'password123' },
        bodyMetadata(RegisterUserDto),
      );
      expect(result.email).toBe('user@example.com');
    });

    it('rejects a malformed email', async () => {
      await expect(
        pipe.transform(
          { email: 'not-an-email', password: 'password123' },
          bodyMetadata(RegisterUserDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a password shorter than 8 characters', async () => {
      await expect(
        pipe.transform(
          { email: 'user@example.com', password: 'short1' },
          bodyMetadata(RegisterUserDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a password without a digit', async () => {
      await expect(
        pipe.transform(
          { email: 'user@example.com', password: 'password' },
          bodyMetadata(RegisterUserDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a password longer than 128 characters', async () => {
      await expect(
        pipe.transform(
          { email: 'user@example.com', password: `${'a'.repeat(128)}1` },
          bodyMetadata(RegisterUserDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unexpected properties (mass-assignment protection)', async () => {
      await expect(
        pipe.transform(
          {
            email: 'user@example.com',
            password: 'password123',
            role: 'ADMIN',
          },
          bodyMetadata(RegisterUserDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('LoginUserDto', () => {
    it('accepts a valid email and password', async () => {
      const result = await pipe.transform(
        { email: 'user@example.com', password: 'password123' },
        bodyMetadata(LoginUserDto),
      );
      expect(result).toBeInstanceOf(LoginUserDto);
    });

    it('rejects a malformed email', async () => {
      await expect(
        pipe.transform(
          { email: 'not-an-email', password: 'password123' },
          bodyMetadata(LoginUserDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty password', async () => {
      await expect(
        pipe.transform(
          { email: 'user@example.com', password: '' },
          bodyMetadata(LoginUserDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
