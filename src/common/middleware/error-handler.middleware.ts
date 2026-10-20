import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { env } from '../../config/env.js';

/**
 * Global centralized error handling middleware.
 * Ensures uniform error response structure and redacts internal details in production.
 */
export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = req.correlationId || 'unknown';

  // Handle body-parser entity too large (payload limit exceeded)
  if ((err as any).type === 'entity.too.large' || (err as any).status === 413) {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the allowable size limit of 100kb',
        correlationId,
      },
    });
    return;
  }

  // Handle malformed JSON request bodies
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
        correlationId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(
        { err, correlationId, url: req.originalUrl, method: req.method },
        'Non-operational AppError occurred'
      );
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        correlationId,
      },
    });
    return;
  }

  // Handle unexpected/programmer errors
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      correlationId,
      url: req.originalUrl,
      method: req.method,
    },
    'Unhandled Internal Server Error'
  );

  const responseMessage =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please contact support with the correlation ID.'
      : err.message;

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: responseMessage,
      correlationId,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};
