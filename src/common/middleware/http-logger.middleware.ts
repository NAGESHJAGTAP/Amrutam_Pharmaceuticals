import { Request, Response, NextFunction } from 'express';
import { logger } from '../logging/logger.js';

/**
 * Middleware to log structured HTTP access events.
 * Logs method, URL, status code, and latency in milliseconds with correlation IDs.
 */
export const httpLoggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: parseFloat(durationMs.toFixed(2)),
      correlationId: req.correlationId,
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'HTTP Request Server Error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'HTTP Request Client Warning');
    } else {
      logger.info(logData, 'HTTP Request Completed');
    }
  });

  next();
};
