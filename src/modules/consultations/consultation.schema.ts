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

export type BookConsultationInput = z.infer<typeof bookConsultationSchema.body>;
export type CancelConsultationInput = z.infer<typeof cancelConsultationSchema.body>;
