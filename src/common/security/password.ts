import argon2 from 'argon2';
import { logger } from '../logging/logger.js';

/**
 * Argon2id password hashing and verification conforming to OWASP guidelines.
 * Memory cost: 65536 KB (64 MB), Time cost: 3 iterations, Parallelism: 4 threads.
 */
export class PasswordUtil {
  public static async hash(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to hash password with Argon2id');
      throw new Error('Cryptographic failure during password hashing');
    }
  }

  public static async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch (error) {
      logger.warn({ error }, 'Password verification encountered an error');
      return false;
    }
  }
}
