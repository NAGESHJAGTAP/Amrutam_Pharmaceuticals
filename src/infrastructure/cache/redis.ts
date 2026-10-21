import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../common/logging/logger.js';

declare global {
  var redisGlobal: Redis | undefined;
}

export const redis: Redis =
  globalThis.redisGlobal ||
  new Redis(env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (env.NODE_ENV !== 'production' && times > 3) {
        return null;
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

redis.on('connect', () => {
  logger.info('Connected to Redis server');
});

redis.on('error', (err) => {
  if (env.NODE_ENV === 'production') {
    logger.error({ err: err.message }, 'Redis client connection error');
  }
});

if (env.NODE_ENV !== 'production') {
  globalThis.redisGlobal = redis;
}

import { databaseHealthStatus, redisHealthStatus } from '../telemetry/metrics.js';

/**
 * Health check helper to verify Redis connectivity with bounded timeout (2500ms).
 * Updates Prometheus dependency health metric and returns safe status metadata.
 */
export const checkRedisHealth = async (timeoutMs = 2500): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number }> => {
  if (env.NODE_ENV !== 'production' && redis.status !== 'ready') {
    redisHealthStatus.set(0);
    return { status: 'DOWN', latencyMs: 0 };
  }
  const start = Date.now();
  try {
    const pingPromise = (async () => {
      if (redis.status !== 'ready' && redis.status !== 'connecting' && redis.status !== 'connect') {
        await redis.connect();
      }
      return await redis.ping();
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis health probe timed out after ' + timeoutMs + 'ms')), timeoutMs)
    );

    const pong = await Promise.race([pingPromise, timeoutPromise]);
    const latencyMs = Date.now() - start;

    if (pong === 'PONG') {
      databaseHealthStatus.set({ dependency: 'redis' }, 1);
      redisHealthStatus.set(1);
      return { status: 'UP', latencyMs };
    }

    databaseHealthStatus.set({ dependency: 'redis' }, 0);
    redisHealthStatus.set(0);
    return { status: 'DOWN', latencyMs };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Redis health check failed');
    databaseHealthStatus.set({ dependency: 'redis' }, 0);
    redisHealthStatus.set(0);
    return { status: 'DOWN', latencyMs: Date.now() - start };
  }
};
