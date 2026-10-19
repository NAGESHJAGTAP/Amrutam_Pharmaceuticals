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

/**
 * Health check helper to verify database connectivity.
 */
export const checkDatabaseHealth = async (): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number }> => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'UP', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return { status: 'DOWN', latencyMs: Date.now() - start };
  }
};
