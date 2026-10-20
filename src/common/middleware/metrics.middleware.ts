import { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  normalizeRoutePath,
} from '../../infrastructure/telemetry/metrics.js';
import { env } from '../../config/env.js';

/**
 * Middleware to record Prometheus metrics for all HTTP requests.
 * Records request counts and duration histograms using normalized route templates.
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.METRICS_ENABLED) {
    return next();
  }

  // Avoid recording scraper / probe requests in application latency histograms
  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (
    path === '/metrics' ||
    path === '/healthz' ||
    path === '/readyz' ||
    path.startsWith('/api/v1/metrics')
  ) {
    return next();
  }

  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationSeconds = Number(endTime - startTime) / 1_000_000_000;
    const normalizedRoute = normalizeRoutePath(req);
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({
      method: req.method,
      route: normalizedRoute,
      status_code: statusCode,
    });

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route: normalizedRoute,
        status_code: statusCode,
      },
      durationSeconds
    );
  });

  next();
};
