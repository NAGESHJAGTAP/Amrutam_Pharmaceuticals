import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { TooManyRequestsError } from '../errors/app-error.js';

/**
 * Strict rate limiter for sensitive authentication endpoints (login, register, MFA verification).
 * Defends against brute-force and credential-stuffing attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 auth requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many authentication attempts. Please try again in 15 minutes.'));
  },
  skip: () => env.NODE_ENV === 'test', // bypass in automated tests to avoid artificial throttling
});

/**
 * General API rate limiter for all public endpoints.
 */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Rate limit exceeded. Please throttle your requests.'));
  },
  skip: () => env.NODE_ENV === 'test',
});
