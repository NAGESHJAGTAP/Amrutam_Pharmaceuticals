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
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

redis.on('connect', () => {
  logger.info('Connected to Redis server');
});

redis.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis client connection error');
});

if (env.NODE_ENV !== 'production') {
  globalThis.redisGlobal = redis;
}

/**
 * Health check helper to verify Redis connectivity.
 */
export const checkRedisHealth = async (): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number }> => {
  const start = Date.now();
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting' && redis.status !== 'connect') {
      await redis.connect();
    }
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return { status: 'UP', latencyMs: Date.now() - start };
    }
    return { status: 'DOWN', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return { status: 'DOWN', latencyMs: Date.now() - start };
  }
};
