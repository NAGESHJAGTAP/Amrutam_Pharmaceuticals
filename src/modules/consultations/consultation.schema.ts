import { z } from 'zod';

export const bookConsultationSchema = {
  body: z.object({
    doctorId: z.string().min(1, 'Doctor ID is required'),
    slotId: z.string().min(1, 'Slot ID is required'),
    reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
  }),
};

export const cancelConsultationSchema = {
  params: z.object({
    consultationId: z.string().min(1, 'Consultation ID is required'),
  }),
  body: z.object({
    reason: z.string().min(3, 'Cancellation reason must be at least 3 characters').max(500).optional(),
  }),
};

export const getConsultationByIdSchema = {
  params: z.object({
    consultationId: z.string().min(1, 'Consultation ID is required'),
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
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).optional(),
};

export type BookConsultationInput = z.infer<typeof bookConsultationSchema.body>;
export type CancelConsultationInput = z.infer<typeof cancelConsultationSchema.body>;
export type ListMyBookingsQuery = z.infer<NonNullable<typeof listMyBookingsSchema.query>>;
export type GetDoctorScheduleQuery = z.infer<NonNullable<typeof getDoctorScheduleSchema.query>>;
