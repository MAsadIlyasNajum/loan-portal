/**
 * Password hashing abstraction so the hashing algorithm can be reused by
 * registration, login and admin provisioning through one implementation.
 * Declared as an abstract class so it can serve as a NestJS
 * injection token.
 */
export abstract class PasswordHasher {
  abstract hash(plaintext: string): Promise<string>;
  abstract verify(plaintext: string, hash: string): Promise<boolean>;
}
