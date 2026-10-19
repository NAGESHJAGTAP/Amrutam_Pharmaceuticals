import { z } from 'zod';

export const webhookEventSchema = {
  body: z.object({
    eventId: z.string().min(1, 'eventId is required'),
    eventType: z.enum(['payment.succeeded', 'payment.failed', 'payment.refunded']),
    timestamp: z.string().datetime(),
    data: z.object({
      paymentReference: z.string().min(1, 'paymentReference is required'),
      providerReference: z.string().optional(),
      amount: z.number().positive(),
      currency: z.string().length(3),
      failureReason: z.string().optional(),
      refundReason: z.string().optional(),
    }),
  }),
};

export const simulateWebhookSchema = {
  body: z.object({
    paymentReference: z.string().min(1, 'paymentReference is required'),
    eventType: z.enum(['payment.succeeded', 'payment.failed', 'payment.refunded']),
    failureReason: z.string().optional(),
    refundReason: z.string().optional(),
  }),
};

export const getPaymentByIdSchema = {
  params: z.object({
    paymentId: z.string().uuid('Invalid payment UUID format'),
  }),
};

export const getPaymentByConsultationSchema = {
  params: z.object({
    consultationId: z.string().uuid('Invalid consultation UUID format'),
  }),
};

export type WebhookEventInput = z.infer<typeof webhookEventSchema.body>;
export type SimulateWebhookInput = z.infer<typeof simulateWebhookSchema.body>;
