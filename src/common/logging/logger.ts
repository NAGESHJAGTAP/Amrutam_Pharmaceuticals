import pino from 'pino';
import { trace } from '@opentelemetry/api';
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
      'req.headers["x-webhook-signature"]',
      'req.headers["x-amrutam-signature"]',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'accessToken',
      'mfaSecret',
      'secret',
      'signature',
      'keyUri',
      'diagnosis',
      'medications',
      'notes',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.mfaSecret',
      '*.secret',
      '*.signature',
      '*.keyUri',
      '*.diagnosis',
      '*.medications',
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    try {
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        return {
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId,
        };
      }
    } catch {
      // In case OpenTelemetry API is not yet initialized or throws
    }
    return {};
  },
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
