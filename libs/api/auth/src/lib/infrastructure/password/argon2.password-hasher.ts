import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasher } from './password-hasher';

/**
 * Argon2id password hasher. `argon2.hash()` defaults to the Argon2id
 * variant with the library's recommended memory, iteration and parallelism
 * parameters, which satisfies the current OWASP password-hashing
 * recommendations. Hashes are self-describing
 * (`$argon2id$v=19$m=...,t=...,p=...$...`) so parameters can be upgraded
 * without invalidating existing hashes.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext);
  }

  async verify(plaintext: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      // Malformed or unsupported hash values must never throw; they simply
      // fail verification.
      return false;
    }
  }
}
