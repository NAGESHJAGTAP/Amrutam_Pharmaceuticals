import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { UserRole } from '@prisma/client';
import { UnauthorizedError } from '../errors/app-error.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface MfaTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  purpose: 'mfa_verification';
}

export class TokenUtil {
  /**
   * Generates a short-lived access JWT token.
   */
  public static generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });
  }

  /**
   * Generates a short-lived pre-auth MFA challenge token (valid for 5 minutes).
   */
  public static generateMfaPreAuthToken(payload: AccessTokenPayload): string {
    return jwt.sign(
      { ...payload, purpose: 'mfa_verification' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' }
    );
  }

  /**
   * Verifies an access token and returns its payload.
   */
  public static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
      return decoded;
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token has expired');
      }
      throw new UnauthorizedError('Invalid access token');
    }
  }

  /**
   * Verifies an MFA pre-auth token.
   */
  public static verifyMfaPreAuthToken(token: string): MfaTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as MfaTokenPayload;
      if (decoded.purpose !== 'mfa_verification') {
        throw new UnauthorizedError('Invalid MFA token purpose');
      }
      return decoded;
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError') {
        throw new UnauthorizedError('MFA verification session has expired. Please log in again.');
      }
      throw new UnauthorizedError('Invalid MFA token');
    }
  }

  /**
   * Generates a cryptographically strong 64-byte random string for refresh tokens.
   */
  public static generateRefreshTokenString(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Computes SHA-256 hash of a refresh token for safe database persistence.
   */
  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
