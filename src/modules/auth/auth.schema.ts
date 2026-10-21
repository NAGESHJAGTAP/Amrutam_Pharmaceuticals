import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    email: z.string().email('Invalid email address').max(255),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,128}$/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    phone: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : undefined))
      .refine((val) => !val || /^\+?[0-9]{7,15}$/.test(val.replace(/[\s-]/g, '')), {
        message: 'Invalid phone number format (must be 7-15 digits)',
      }),
    role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']).optional().default('PATIENT'),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const refreshTokenSchema = {
  body: z.object({
    refreshToken: z.string().min(32, 'Invalid refresh token format'),
  }),
};

export const logoutSchema = {
  body: z.object({
    refreshToken: z.string().optional().nullable().or(z.literal('')),
  }),
};

export const mfaVerifyLoginSchema = {
  body: z.object({
    mfaToken: z.string().min(16, 'MFA pre-auth token is required'),
    code: z.string().length(6, 'TOTP code must be exactly 6 digits').regex(/^\d{6}$/, 'Code must contain only digits'),
  }),
};

export const mfaVerifySetupSchema = {
  body: z.object({
    code: z.string().length(6, 'TOTP code must be exactly 6 digits').regex(/^\d{6}$/, 'Code must contain only digits'),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
  }),
};

export type RegisterInput = z.infer<typeof registerSchema.body>;
export type LoginInput = z.infer<typeof loginSchema.body>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema.body>;
export type MfaVerifyLoginInput = z.infer<typeof mfaVerifyLoginSchema.body>;
export type MfaVerifySetupInput = z.infer<typeof mfaVerifySetupSchema.body>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema.body>;
