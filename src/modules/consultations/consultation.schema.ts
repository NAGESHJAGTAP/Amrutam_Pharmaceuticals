import { z } from 'zod';

export const bookConsultationSchema = {
  body: z.object({
    doctorId: z.string().uuid('Invalid doctor UUID format'),
    slotId: z.string().uuid('Invalid slot UUID format'),
    reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
  }),
};

export const cancelConsultationSchema = {
  params: z.object({
    consultationId: z.string().uuid('Invalid consultation UUID format'),
  }),
  body: z.object({
    reason: z.string().min(3, 'Cancellation reason must be at least 3 characters').max(500).optional(),
  }),
};

export const getConsultationByIdSchema = {
  params: z.object({
    consultationId: z.string().uuid('Invalid consultation UUID format'),
  }),
};

export const listMyBookingsSchema = {
  query: z.object({
    status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).optional(),
};

export const getDoctorScheduleSchema = {
  query: z.object({
    status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).optional(),
};

export type BookConsultationInput = z.infer<typeof bookConsultationSchema.body>;
export type CancelConsultationInput = z.infer<typeof cancelConsultationSchema.body>;
export type ListMyBookingsQuery = z.infer<NonNullable<typeof listMyBookingsSchema.query>>;
export type GetDoctorScheduleQuery = z.infer<NonNullable<typeof getDoctorScheduleSchema.query>>;
