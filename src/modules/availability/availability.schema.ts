import { z } from 'zod';

export const createSlotSchema = {
  body: z
    .object({
      doctorId: z.string().uuid('Invalid doctor UUID format'),
      startTime: z.string().datetime({ message: 'startTime must be a valid ISO-8601 UTC timestamp' }),
      endTime: z.string().datetime({ message: 'endTime must be a valid ISO-8601 UTC timestamp' }),
    })
    .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
      message: 'startTime must strictly precede endTime',
      path: ['endTime'],
    })
    .refine((data) => new Date(data.startTime) > new Date(), {
      message: 'startTime must be in the future',
      path: ['startTime'],
    }),
};

export const getSlotsSchema = {
  query: z.object({
    doctorId: z.string().uuid('Invalid doctor UUID format'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};

export const cancelSlotSchema = {
  params: z.object({
    slotId: z.string().uuid('Invalid slot UUID format'),
  }),
};

export type CreateSlotInput = z.infer<typeof createSlotSchema.body>;
export type GetSlotsQuery = z.infer<typeof getSlotsSchema.query>;
