import { Queue } from 'bullmq';
import {
  getRedisConnectionOptions,
  QUEUE_NAMES,
  DEFAULT_QUEUE_JOB_OPTIONS,
} from '../../infrastructure/queue/bullmq.config.js';
import {
  NotificationJobPayload,
  ReminderJobPayload,
  notificationJobPayloadSchema,
  reminderJobPayloadSchema,
} from '../notifications/notification.types.js';
import { logger } from '../../common/logging/logger.js';

export class QueueManager {
  public notificationQueue: Queue<NotificationJobPayload>;
  public reminderQueue: Queue<ReminderJobPayload>;

  constructor() {
    const connection = getRedisConnectionOptions();

    this.notificationQueue = new Queue<NotificationJobPayload>(QUEUE_NAMES.NOTIFICATIONS, {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
    });

    this.reminderQueue = new Queue<ReminderJobPayload>(QUEUE_NAMES.REMINDERS, {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
    });
  }

  /**
   * Enqueues a notification job with deterministic jobId for idempotent deduplication.
   */
  public async enqueueNotification(payload: NotificationJobPayload, customJobId?: string) {
    const validated = notificationJobPayloadSchema.parse(payload);
    const jobId = customJobId || `notif:${validated.eventId}:${validated.recipientId}`;

    const job = await this.notificationQueue.add(validated.eventType, validated, {
      jobId,
    });

    logger.debug({ jobId: job.id, eventType: validated.eventType }, 'Notification job enqueued to BullMQ');
    return job;
  }

  /**
   * Schedules a delayed reminder job.
   */
  public async scheduleReminder(payload: ReminderJobPayload, delayMs: number) {
    const validated = reminderJobPayloadSchema.parse(payload);
    const jobId = `reminder:${validated.consultationId}:${validated.reminderType}`;

    const job = await this.reminderQueue.add('consultation.reminder', validated, {
      jobId,
      delay: Math.max(0, delayMs),
    });

    logger.info(
      {
        jobId: job.id,
        consultationId: validated.consultationId,
        reminderType: validated.reminderType,
        delayMs,
      },
      'Consultation reminder scheduled in BullMQ'
    );

    return job;
  }

  /**
   * Gracefully closes queue connections.
   */
  public async closeQueues() {
    await Promise.all([this.notificationQueue.close(), this.reminderQueue.close()]);
  }
}

export const queueManager = new QueueManager();
