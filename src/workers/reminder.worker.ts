import { Worker, Job } from 'bullmq';
import {
  getRedisConnectionOptions,
  QUEUE_NAMES,
} from '../infrastructure/queue/bullmq.config.js';
import {
  ReminderJobPayload,
  reminderJobPayloadSchema,
} from '../modules/notifications/notification.types.js';
import { notificationService } from '../modules/notifications/notification.service.js';
import { prisma } from '../infrastructure/database/prisma.js';
import { logger } from '../common/logging/logger.js';
import { ConsultationStatus } from '@prisma/client';
import { backgroundJobsTotal } from '../infrastructure/telemetry/metrics.js';

/**
 * BullMQ Worker responsible for processing delayed consultation reminder jobs.
 * Enforces pre-condition checks: verified that consultation is still SCHEDULED
 * and has not been CANCELLED or COMPLETED before dispatching reminders.
 */
export const createReminderWorker = () => {
  const connection = getRedisConnectionOptions();

  const worker = new Worker<ReminderJobPayload>(
    QUEUE_NAMES.REMINDERS,
    async (job: Job<ReminderJobPayload>) => {
      const validated = reminderJobPayloadSchema.parse(job.data);
      const { consultationId, reminderType } = validated;

      logger.info(
        {
          jobId: job.id,
          consultationId,
          reminderType,
        },
        'Evaluating consultation reminder job'
      );

      // 1. Fetch live consultation record from PostgreSQL to verify validity
      const consultation = await prisma.consultation.findUnique({
        where: { id: consultationId },
        include: {
          patient: { include: { profile: true } },
          doctor: { include: { user: { include: { profile: true } } } },
        },
      });

      if (!consultation) {
        logger.warn({ consultationId }, 'Consultation no longer exists; skipping reminder');
        return { skipped: true, reason: 'NOT_FOUND' };
      }

      // 2. Cancellation and Rescheduling Safety:
      // If consultation is CANCELLED or COMPLETED, do not dispatch stale reminders!
      if (consultation.status !== ConsultationStatus.SCHEDULED) {
        logger.info(
          {
            consultationId,
            status: consultation.status,
            reminderType,
          },
          'Skipping reminder because consultation is not in SCHEDULED status'
        );
        return { skipped: true, reason: `STATUS_${consultation.status}` };
      }

      // 3. Format safe reminder notification
      const patientName = consultation.patient.profile
        ? `${consultation.patient.profile.firstName} ${consultation.patient.profile.lastName}`
        : 'Patient';
      const doctorName = consultation.doctor.user.profile
        ? `Dr. ${consultation.doctor.user.profile.firstName} ${consultation.doctor.user.profile.lastName}`
        : 'Dr. Practitioner';

      const timeUntil = reminderType === '24h' ? '24 hours' : '1 hour';
      const formattedTime = new Date(consultation.startTime).toUTCString();

      const reminderNotification = {
        eventId: `remind_${consultation.id}_${reminderType}`,
        eventType: 'consultation.reminder' as const,
        recipientId: consultation.patientId,
        recipientEmail: consultation.patient.email,
        recipientPhone: consultation.patient.phone || undefined,
        recipientName: patientName,
        channel: 'EMAIL' as const,
        subject: `Reminder: Upcoming Consultation with ${doctorName} in ${timeUntil}`,
        message: `Hello ${patientName}, this is a reminder that your Ayurvedic telemedicine consultation with ${doctorName} is scheduled in ${timeUntil} at ${formattedTime}. Please ensure a stable internet connection.`,
      };

      const result = await notificationService.dispatchNotification(reminderNotification);

      logger.info(
        {
          consultationId,
          reminderType,
          messageId: result.messageId,
        },
        'Consultation reminder dispatched successfully'
      );

      return {
        skipped: false,
        delivered: true,
        messageId: result.messageId,
      };
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job: Job) => {
    backgroundJobsTotal.inc({ queue_name: QUEUE_NAMES.REMINDERS, status: 'completed' });
    logger.debug({ jobId: job.id }, 'Reminder job completed');
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    backgroundJobsTotal.inc({ queue_name: QUEUE_NAMES.REMINDERS, status: 'failed' });
    logger.error(
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        err: err.message,
      },
      'Reminder job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Reminder worker error');
  });

  return worker;
};
