import pino from 'pino';
import { env } from '../../config/env.js';

/**
 * Structured logger configured with Pino.
 * Automatically redacts sensitive fields to prevent leaking passwords, tokens, or PII.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["idempotency-key"]',
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'accessToken',
      'mfaSecret',
      'secret',
      '*.password',
      '*.token',
      '*.secret',
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
