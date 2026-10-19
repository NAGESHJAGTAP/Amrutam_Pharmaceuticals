import { z } from 'zod';

export const getProfileSchema = {
  params: z.object({
    userId: z.string().uuid('Invalid user UUID format'),
  }),
};

export const updateProfileSchema = {
  params: z.object({
    userId: z.string().uuid('Invalid user UUID format'),
  }),
  body: z.object({
    firstName: z.string().min(1, 'First name cannot be empty').max(100).optional(),
    lastName: z.string().min(1, 'Last name cannot be empty').max(100).optional(),
    dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')).optional(),
    gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']).optional(),
    emergencyContact: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid emergency contact phone format').optional(),
  }),
};

export type UpdateProfileInput = z.infer<typeof updateProfileSchema.body>;
