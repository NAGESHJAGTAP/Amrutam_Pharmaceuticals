import { z } from 'zod';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP';

export const notificationEventTypeSchema = z.enum([
  'consultation.booked',
  'consultation.cancelled',
  'payment.completed',
  'payment.failed',
  'payment.refunded',
  'prescription.finalized',
  'consultation.reminder',
]);

export type NotificationEventType = z.infer<typeof notificationEventTypeSchema>;

/**
 * Validated schema for notification queue jobs.
 * Enforces recipient identifiers, channels, and safe content.
 */
export const notificationJobPayloadSchema = z.object({
  eventId: z.string().min(1),
  eventType: notificationEventTypeSchema,
  recipientId: z.string().min(1),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  recipientName: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'IN_APP']).default('EMAIL'),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type NotificationJobPayload = z.infer<typeof notificationJobPayloadSchema>;

/**
 * Validated schema for scheduled reminder queue jobs.
 */
export const reminderJobPayloadSchema = z.object({
  consultationId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledStartTime: z.string().datetime(),
  reminderType: z.enum(['24h', '1h']),
});

export type ReminderJobPayload = z.infer<typeof reminderJobPayloadSchema>;
