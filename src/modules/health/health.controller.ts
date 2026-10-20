import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../../infrastructure/database/prisma.js';
import { checkRedisHealth } from '../../infrastructure/cache/redis.js';
import { metricsRegistry } from '../../infrastructure/telemetry/metrics.js';
import { env } from '../../config/env.js';

export class HealthController {
  /**
   * Liveness probe: returns 200 OK as long as the HTTP event loop is alive.
   * Reports system uptime and safe process memory statistics.
   */
  public getLiveness = (_req: Request, res: Response): void => {
    const memory = process.memoryUsage();
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Readiness probe: actively queries PostgreSQL and Redis with bounded timeouts.
   * Returns 200 OK if all dependencies are healthy, or 503 Service Unavailable if unhealthy.
   * Never exposes credentials, connection URLs, or internal database stack traces.
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

  /**
   * Prometheus metrics endpoint.
   * Returns text/plain formatted Prometheus metrics.
   * If METRICS_AUTH_TOKEN is configured, requires Bearer authentication.
   */
  public getMetrics = async (req: Request, res: Response): Promise<void> => {
    if (env.METRICS_AUTH_TOKEN) {
      const authHeader = req.headers.authorization;
      const metricsKeyHeader = req.headers['x-metrics-key'];
      const expectedBearer = `Bearer ${env.METRICS_AUTH_TOKEN}`;

      if (authHeader !== expectedBearer && metricsKeyHeader !== env.METRICS_AUTH_TOKEN) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized access to Prometheus metrics',
            correlationId: req.correlationId || 'unknown',
          },
        });
        return;
      }
    }

    res.setHeader('Content-Type', metricsRegistry.contentType);
    const metricsData = await metricsRegistry.metrics();
    res.status(200).send(metricsData);
  };
}

export const healthController = new HealthController();
