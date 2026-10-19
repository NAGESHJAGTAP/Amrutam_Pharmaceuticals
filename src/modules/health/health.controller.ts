import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../../infrastructure/database/prisma.js';
import { checkRedisHealth } from '../../infrastructure/cache/redis.js';

export class HealthController {
  /**
   * Liveness probe: returns 200 OK as long as the HTTP event loop is alive.
   */
  public getLiveness = (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Readiness probe: actively queries PostgreSQL and Redis.
   * Returns 200 OK if all dependencies are healthy, or 503 Service Unavailable if unhealthy.
   */
  public getReadiness = async (_req: Request, res: Response): Promise<void> => {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const isHealthy = dbHealth.status === 'UP' && redisHealth.status === 'UP';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'READY' : 'NOT_READY',
      checks: {
        server: 'UP',
        database: dbHealth,
        redis: redisHealth,
      },
      timestamp: new Date().toISOString(),
    });
  };
}

export const healthController = new HealthController();
