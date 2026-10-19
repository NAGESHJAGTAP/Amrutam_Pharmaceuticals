import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      requestId: string;
    }
  }
}

/**
 * Middleware to trace incoming requests across services.
 * Attaches X-Correlation-ID and X-Request-ID to the request object and response headers.
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingCorrelationId = req.headers['x-correlation-id'] as string | undefined;
  const correlationId = incomingCorrelationId || crypto.randomUUID();
  const requestId = crypto.randomUUID();

  req.correlationId = correlationId;
  req.requestId = requestId;

  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', requestId);

  next();
};
