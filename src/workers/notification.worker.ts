import { Worker, Job } from 'bullmq';
import {
  getRedisConnectionOptions,
  QUEUE_NAMES,
} from '../infrastructure/queue/bullmq.config.js';
import {
  NotificationJobPayload,
  notificationJobPayloadSchema,
} from '../modules/notifications/notification.types.js';
import { notificationService } from '../modules/notifications/notification.service.js';
import { logger } from '../common/logging/logger.js';

import { backgroundJobsTotal } from '../infrastructure/telemetry/metrics.js';

/**
 * BullMQ Worker responsible for processing notification jobs asynchronously.
 */
export const createNotificationWorker = () => {
  const connection = getRedisConnectionOptions();

  const worker = new Worker<NotificationJobPayload>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotificationJobPayload>) => {
      logger.info(
        {
          jobId: job.id,
          attempt: job.attemptsMade + 1,
          eventType: job.data.eventType,
          recipientId: job.data.recipientId,
        },
        'Processing notification job'
      );

      // Validate payload schema at worker boundary
      const validated = notificationJobPayloadSchema.parse(job.data);

      const result = await notificationService.dispatchNotification(validated);
      return result;
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job: Job) => {
    backgroundJobsTotal.inc({ queue_name: QUEUE_NAMES.NOTIFICATIONS, status: 'completed' });
    logger.info({ jobId: job.id, eventType: job.data.eventType }, 'Notification job completed');
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    backgroundJobsTotal.inc({ queue_name: QUEUE_NAMES.NOTIFICATIONS, status: 'failed' });
    logger.error(
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        err: err.message,
      },
      'Notification job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Notification worker error');
  });

  return worker;
};
