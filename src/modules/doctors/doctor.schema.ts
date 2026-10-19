import { z } from 'zod';

export const searchDoctorsSchema = {
  query: z.object({
    specialty: z.string().optional(),
    minExperience: z.coerce.number().min(0).optional(),
    maxFee: z.coerce.number().min(0).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),
    sortBy: z.enum(['experienceYears', 'consultationFee', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

export const getDoctorByIdSchema = {
  params: z.object({
    doctorId: z.string().uuid('Invalid doctor UUID format'),
  }),
};

export const updateDoctorSchema = {
  params: z.object({
    doctorId: z.string().uuid('Invalid doctor UUID format'),
  }),
  body: z.object({
    specialty: z.string().min(2).max(100).optional(),
    experienceYears: z.number().min(0).max(70).optional(),
    consultationFee: z.number().min(0).max(100000).optional(),
    bio: z.string().max(2000).optional(),
    currency: z.string().length(3).optional(),
  }),
};

export type SearchDoctorsQuery = z.infer<typeof searchDoctorsSchema.query>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema.body>;
