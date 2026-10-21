import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/logging/logger.js';
import { env } from '../../config/env.js';

/**
 * Global singleton instance of PrismaClient.
 * Configured with connection pooling and query event logging.
 */
declare global {
  // Prevent multiple instances of Prisma Client in development across hot-reloads
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.prismaGlobal ||
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

if (env.NODE_ENV === 'development') {
  // @ts-ignore - Prisma event typing
  prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
    logger.debug(
      {
        query: e.query,
        params: e.params,
        durationMs: e.duration,
      },
      'Prisma Query Executed'
    );
  });
}

// @ts-ignore - Prisma event typing
prisma.$on('error', (e: { message: string }) => {
  logger.error({ error: e.message }, 'Prisma Database Error');
});

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

let dbOfflineUntil = 0;

export const isDatabaseReachable = (): boolean => {
  return Date.now() >= dbOfflineUntil;
};

export const markDatabaseUnreachable = (durationMs = 120000): void => {
  if (env.NODE_ENV === 'test') {
    return;
  }
  dbOfflineUntil = Date.now() + durationMs;
};

export const markDatabaseReachable = (): void => {
  dbOfflineUntil = 0;
};

import { databaseHealthStatus } from '../telemetry/metrics.js';

/**
 * Health check helper to verify database connectivity with bounded timeout (2500ms).
 * Updates Prometheus dependency health metric and returns safe status metadata.
 */
export const checkDatabaseHealth = async (timeoutMs = 2500): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number }> => {
  if (!isDatabaseReachable()) {
    databaseHealthStatus.set({ dependency: 'postgres' }, 0);
    return { status: 'DOWN', latencyMs: 0 };
  }
  const start = Date.now();
  try {
    const queryPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database health probe timed out after ' + timeoutMs + 'ms')), timeoutMs)
    );

    await Promise.race([queryPromise, timeoutPromise]);
    const latencyMs = Date.now() - start;
    databaseHealthStatus.set({ dependency: 'postgres' }, 1);
    return { status: 'UP', latencyMs };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Database health check failed');
    databaseHealthStatus.set({ dependency: 'postgres' }, 0);
    return { status: 'DOWN', latencyMs: Date.now() - start };
  }
};
