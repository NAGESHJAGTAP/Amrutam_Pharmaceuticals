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
