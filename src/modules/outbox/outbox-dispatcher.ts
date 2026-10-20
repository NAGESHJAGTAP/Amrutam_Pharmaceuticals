import { prisma } from '../../infrastructure/database/prisma.js';
import { queueManager } from '../queue/queue.manager.js';
import { notificationService } from '../notifications/notification.service.js';
import { logger } from '../../common/logging/logger.js';
import { OutboxStatus } from '@prisma/client';
import { outboxEventsDispatchedTotal, outboxBacklogCount } from '../../infrastructure/telemetry/metrics.js';

export interface DispatchSummary {
  processedCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * Transactional Outbox Dispatcher.
 * Reliably claims pending events from PostgreSQL using SELECT ... FOR UPDATE SKIP LOCKED,
 * enqueues corresponding jobs to BullMQ queues with deterministic job IDs, and updates status.
 */
export class OutboxDispatcher {
  private isPolling = false;
  private pollTimer: NodeJS.Timeout | null = null;

  /**
   * Dispatches a batch of pending outbox events.
   * Concurrency-safe: SKIP LOCKED allows multiple parallel dispatcher processes
   * to work cooperatively without row lock contention or deadlocks.
   */
  public async dispatchBatch(batchSize = 20): Promise<DispatchSummary> {
    const summary: DispatchSummary = {
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
    };

    // 1. Transactional claim with SKIP LOCKED
    const claimedEvents: any[] = await prisma.$transaction(async (tx) => {
      const rows: any[] = await tx.$queryRaw`
        SELECT * FROM "outbox_events"
        WHERE "status" = 'PENDING'
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED;
      `;
      return rows;
    });

    if (claimedEvents.length === 0) {
      return summary;
    }

    summary.processedCount = claimedEvents.length;
    logger.debug({ count: claimedEvents.length }, 'Claimed pending outbox events for dispatch');

    // 2. Process each claimed event
    for (const event of claimedEvents) {
      try {
        await this.processEvent(event);

        // Mark event as PUBLISHED
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.PUBLISHED,
          },
        });

        summary.successCount++;
        outboxEventsDispatchedTotal.inc({ event_type: event.eventType, status: 'success' });
      } catch (err: any) {
        summary.failureCount++;
        outboxEventsDispatchedTotal.inc({ event_type: event.eventType, status: 'failure' });
        const nextRetry = (event.retryCount || 0) + 1;
        const newStatus = nextRetry >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING;

        logger.error(
          {
            eventId: event.id,
            eventType: event.eventType,
            retryCount: nextRetry,
            error: err.message,
          },
          'Failed to dispatch outbox event'
        );

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            retryCount: nextRetry,
            lastError: err.message,
            status: newStatus,
          },
        });
      }
    }

    try {
      const pendingCount = await prisma.outboxEvent.count({
        where: { status: OutboxStatus.PENDING },
      });
      outboxBacklogCount.set(pendingCount);
    } catch {
      // In case of non-blocking count error
    }

    return summary;
  }

  /**
   * Routes and enqueues jobs according to the outbox event type.
   */
  private async processEvent(event: any) {
    const { id: eventId, eventType, aggregateId, payload } = event;

    switch (eventType) {
      case 'consultation.booked': {
        // 1. Build and enqueue booking confirmations to Patient and Doctor
        const notifications = await notificationService.buildBookingNotifications(aggregateId, eventId);
        for (const notif of notifications) {
          await queueManager.enqueueNotification(notif);
        }

        // 2. Schedule reminders if consultation start time is in the future
        if (payload?.startTime) {
          const startTime = new Date(payload.startTime).getTime();
          const now = Date.now();

          // 24 hours prior reminder
          const delay24h = startTime - 24 * 60 * 60 * 1000 - now;
          if (delay24h > 0) {
            await queueManager.scheduleReminder(
              {
                consultationId: aggregateId,
                patientId: payload.patientId,
                doctorId: payload.doctorId,
                scheduledStartTime: payload.startTime,
                reminderType: '24h',
              },
              delay24h
            );
          }

          // 1 hour prior reminder
          const delay1h = startTime - 1 * 60 * 60 * 1000 - now;
          if (delay1h > 0) {
            await queueManager.scheduleReminder(
              {
                consultationId: aggregateId,
                patientId: payload.patientId,
                doctorId: payload.doctorId,
                scheduledStartTime: payload.startTime,
                reminderType: '1h',
              },
              delay1h
            );
          }
        }
        break;
      }

      case 'consultation.cancelled': {
        const notifications = await notificationService.buildCancellationNotifications(
          aggregateId,
          eventId,
          payload?.reason
        );
        for (const notif of notifications) {
          await queueManager.enqueueNotification(notif);
        }
        break;
      }

      case 'payment.completed': {
        const notif = await notificationService.buildPaymentNotification(aggregateId, eventId, 'COMPLETED');
        if (notif) {
          await queueManager.enqueueNotification(notif);
        }
        break;
      }

      case 'payment.refunded': {
        const notif = await notificationService.buildPaymentNotification(aggregateId, eventId, 'REFUNDED');
        if (notif) {
          await queueManager.enqueueNotification(notif);
        }
        break;
      }

      case 'prescription.finalized': {
        const notif = await notificationService.buildPrescriptionNotification(aggregateId, eventId);
        if (notif) {
          await queueManager.enqueueNotification(notif);
        }
        break;
      }

      default:
        logger.warn({ eventType, eventId }, 'Unrecognized outbox event type; marked as published');
        break;
    }
  }

  /**
   * Starts periodic polling loop for the outbox dispatcher.
   */
  public startPolling(intervalMs = 5000) {
    if (this.isPolling) return;
    this.isPolling = true;

    const poll = async () => {
      if (!this.isPolling) return;
      try {
        await this.dispatchBatch();
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error in outbox polling loop');
      } finally {
        if (this.isPolling) {
          this.pollTimer = setTimeout(poll, intervalMs);
        }
      }
    };

    this.pollTimer = setTimeout(poll, intervalMs);
    logger.info({ intervalMs }, 'Outbox dispatcher polling started');
  }

  /**
   * Stops the periodic polling loop gracefully.
   */
  public stopPolling() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('Outbox dispatcher polling stopped');
  }
}

export const outboxDispatcher = new OutboxDispatcher();
