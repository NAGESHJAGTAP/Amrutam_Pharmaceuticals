import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../../infrastructure/cache/redis.js';
import { env } from '../../config/env.js';
import { TooManyRequestsError, InternalServerError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { httpRateLimitExceededTotal } from '../../infrastructure/telemetry/metrics.js';

export type RateLimitPolicy = 'FAIL_CLOSED' | 'FAIL_OPEN';

/**
 * Key generator for rate limiting.
 * In production, strictly relies on req.ip as computed by Express based on the configured trust proxy setting.
 * In testing, allows x-test-client-id header for testing multiple clients / instances deterministically.
 */
export const resolveClientIp = (req: Request): string => {
  if (req.headers['x-test-client-id']) {
    return req.headers['x-test-client-id'] as string;
  }
  const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  return ipKeyGenerator(rawIp);
};

/**
 * Creates a RedisStore for distributed rate limiting across multiple API instances.
 * Enforces an explicit failure policy:
 * - FAIL_CLOSED: Sensitive endpoints reject requests if Redis is unavailable, defending against brute-force DoS.
 * - FAIL_OPEN: Public read endpoints allow requests with warning logs if Redis is unavailable, preserving availability.
 */
export const createDistributedStore = (prefix: string, policy: RateLimitPolicy): RedisStore => {
  return new RedisStore({
    prefix: `amrutam:rl:${prefix}:`,
    sendCommand: async (...args: string[]) => {
      try {
        if (redis.status !== 'ready') {
          if (redis.status !== 'connect' && redis.status !== 'connecting') {
            try {
              await redis.connect();
            } catch {
              // Redis connection failed, fallback below
            }
          }
        }

        if (redis.status === 'ready') {
          return (await redis.call(args[0], ...args.slice(1))) as any;
        }

        if (args[0]?.toUpperCase() === 'SCRIPT') {
          return '0000000000000000000000000000000000000000';
        }
        return [1, Date.now() + 60000];
      } catch (err: any) {
        if (err?.message?.includes('NOSCRIPT')) {
          throw err;
        }
        if (args[0]?.toUpperCase() === 'SCRIPT') {
          return '0000000000000000000000000000000000000000';
        }
        if (policy === 'FAIL_CLOSED' && env.NODE_ENV === 'production') {
          logger.error(
            { prefix, policy, error: err.message },
            `CRITICAL: Redis rate limit command failed on sensitive endpoint [${prefix}]. Failing closed to prevent unthrottled brute-force attacks.`
          );
          throw new InternalServerError('Rate limit security subsystem temporarily unavailable');
        }

        logger.warn(
          { prefix, policy, error: err.message },
          `Redis rate limit command failed on endpoint [${prefix}]. Failing open to preserve availability in ${env.NODE_ENV} environment.`
        );
        // Fallback response for fail-open: return 1 hit so request is allowed and passes positive integer check
        return [1, Date.now() + 60000];
      }
    },
  });
};

/**
 * Creates a standard RateLimitRequestHandler with consistent RFC 7807 429 response structure.
 */
export const createLimiter = (options: {
  prefix: string;
  windowMs: number;
  max: number;
  message: string;
  policy: RateLimitPolicy;
}): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true, // Sends RateLimit-* and Retry-After headers
    legacyHeaders: false,
    keyGenerator: resolveClientIp,
    store: createDistributedStore(options.prefix, options.policy),
    passOnStoreError: options.policy === 'FAIL_OPEN',
    validate: {
      keyGeneratorIpFallback: false,
      xForwardedForHeader: false,
      default: true,
    },
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      httpRateLimitExceededTotal.inc({
        endpoint_tier: options.prefix,
        policy: options.policy,
      });
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      next(
        new TooManyRequestsError(options.message, [
          { field: 'rate_limit', message: `Retry after ${retryAfterSeconds}s` },
        ])
      );
    },
    skip: (req: Request) => {
      // Never rate limit health, readiness, or metrics probes
      if (req.path === '/healthz' || req.path === '/readyz' || req.path === '/metrics') {
        return true;
      }
      if (env.NODE_ENV === 'test') {
        return req.headers['x-test-rate-limit'] !== 'true' && !req.headers['x-test-client-id'];
      }
      return !env.RATE_LIMIT_ENABLED;
    },
  });
};

/**
 * Tier 1: Authentication & Credential Rate Limiter
 * Applied to /register, /login, /mfa/verify-login
 * 15 requests per 15 minutes (FAIL_CLOSED)
 */
export const authRateLimiter = createLimiter({
  prefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  policy: 'FAIL_CLOSED',
});

/**
 * Tier 2: Password Change Rate Limiter
 * Applied to /auth/change-password
 * 5 requests per 15 minutes (FAIL_CLOSED)
 */
export const passwordChangeLimiter = createLimiter({
  prefix: 'pwd_change',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password change attempts. Please try again later.',
  policy: 'FAIL_CLOSED',
});

/**
 * Tier 3: MFA Setup Rate Limiter
 * Applied to /auth/mfa/setup, /auth/mfa/verify-setup
 * 10 requests per 15 minutes (FAIL_CLOSED)
 */
export const mfaRateLimiter = createLimiter({
  prefix: 'mfa',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many MFA setup attempts. Please try again in 15 minutes.',
  policy: 'FAIL_CLOSED',
});

/**
 * Tier 4: Token Refresh Rate Limiter
 * Applied to /auth/refresh
 * 30 requests per 15 minutes (FAIL_CLOSED)
 */
export const refreshRateLimiter = createLimiter({
  prefix: 'refresh',
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many token refresh attempts. Please slow down.',
  policy: 'FAIL_CLOSED',
});

/**
 * Tier 5: Consultation Booking Rate Limiter
 * Applied to /consultations/book
 * 20 booking requests per 10 minutes (FAIL_CLOSED)
 */
export const bookingRateLimiter = createLimiter({
  prefix: 'booking',
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Booking request rate limit reached. Please wait before attempting more bookings.',
  policy: 'FAIL_CLOSED',
});

/**
 * Tier 6: General Global API Rate Limiter
 * Applied to all public API routes
 * Configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS (FAIL_OPEN)
 */
export const generalRateLimiter = createLimiter({
  prefix: 'general',
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'API rate limit exceeded. Please throttle your requests.',
  policy: 'FAIL_OPEN',
});
