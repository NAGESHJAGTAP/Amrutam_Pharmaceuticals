import { generateSecret, generateURI, verifySync } from 'otplib';

export class MfaUtil {
  /**
   * Generates a base32 TOTP secret for the user.
   */
  public static generateSecret(): string {
    return generateSecret();
  }

  /**
   * Generates the standard otpauth:// URI for QR code generation in authenticator apps (Google Authenticator, Authy).
   */
  public static generateKeyUri(email: string, secret: string): string {
    return generateURI({
      secret,
      label: email,
      issuer: 'Amrutam Telemedicine',
    });
  }

  /**
   * Verifies a 6-digit TOTP code against the user's secret.
   * Tolerates +/- 1 time step (30 seconds) for clock drift.
   */
  public static verifyTotp(token: string, secret: string): boolean {
    const result = verifySync({
      token,
      secret,
      epochTolerance: 30, // 30s window tolerance
    });
    return !!result.valid;
  }
}
