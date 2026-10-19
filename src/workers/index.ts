import { createNotificationWorker } from './notification.worker.js';
import { createReminderWorker } from './reminder.worker.js';
import { outboxDispatcher } from '../modules/outbox/outbox-dispatcher.js';
import { queueManager } from '../modules/queue/queue.manager.js';
import { logger } from '../common/logging/logger.js';
import { Worker } from 'bullmq';

export class WorkerManager {
  private notificationWorker: Worker | null = null;
  private reminderWorker: Worker | null = null;
  private isRunning = false;

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('Starting BullMQ workers and Transactional Outbox dispatcher...');

    // 1. Initialize BullMQ Workers
    this.notificationWorker = createNotificationWorker();
    this.reminderWorker = createReminderWorker();

    // 2. Start Outbox Dispatcher polling loop
    outboxDispatcher.startPolling(5000);

    logger.info('Workers and Outbox Dispatcher initialized successfully');
  }

  public async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    logger.info('Gracefully shutting down BullMQ workers and Outbox Dispatcher...');

    // Stop outbox polling
    outboxDispatcher.stopPolling();

    // Close BullMQ workers (waits for active jobs to finish)
    const workerClosePromises = [];
    if (this.notificationWorker) {
      workerClosePromises.push(this.notificationWorker.close());
    }
    if (this.reminderWorker) {
      workerClosePromises.push(this.reminderWorker.close());
    }
    await Promise.all(workerClosePromises);

    // Close BullMQ queue connections
    await queueManager.closeQueues();

    logger.info('All workers and queues closed gracefully');
  }
}

export const workerManager = new WorkerManager();

// If executed directly as standalone process:
const isMainScript =
  typeof process !== 'undefined' &&
  (process.env.RUN_WORKERS === 'true' ||
    Boolean(process.argv[1] && process.argv[1].endsWith('workers/index.js')));

if (isMainScript) {
  workerManager.start().catch((err) => {
    logger.fatal({ err }, 'Fatal error starting worker process');
    process.exit(1);
  });

  const handleShutdown = async (signal: string) => {
    logger.info({ signal }, 'Received termination signal; starting graceful shutdown');
    await workerManager.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

