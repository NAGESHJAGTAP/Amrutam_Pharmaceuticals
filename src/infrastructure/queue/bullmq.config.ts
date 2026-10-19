import { ConnectionOptions, DefaultJobOptions } from 'bullmq';
import { env } from '../../config/env.js';

/**
 * Creates connection options for BullMQ queues and workers.
 * BullMQ requires `maxRetriesPerRequest: null` for blocking Redis operations.
 */
export const getRedisConnectionOptions = (): ConnectionOptions => {
  const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
};

export const QUEUE_NAMES = {
  NOTIFICATIONS: 'amrutam-notifications',
  REMINDERS: 'amrutam-reminders',
} as const;

/**
 * Bounded retries with exponential backoff and jitter for resilient background job processing.
 */
export const DEFAULT_QUEUE_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: {
    count: 500, // Keep last 500 completed jobs for audit
    age: 24 * 3600, // 24 hours
  },
  removeOnFail: {
    count: 1000, // Keep last 1000 failed jobs for Dead Letter inspection
  },
};
