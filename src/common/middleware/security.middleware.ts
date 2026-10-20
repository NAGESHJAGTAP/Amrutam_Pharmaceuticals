import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../errors/app-error.js';

const SUSPICIOUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Recursively scans an object for prototype pollution vectors.
 */
const detectPrototypePollution = (obj: any): boolean => {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  for (const key of Object.getOwnPropertyNames(obj)) {
    if (SUSPICIOUS_KEYS.includes(key.toLowerCase())) {
      return true;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (detectPrototypePollution(obj[key])) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Defensive middleware to reject prototype pollution payloads.
 */
export const prototypePollutionDefense = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && detectPrototypePollution(req.body)) {
    return next(new BadRequestError('Malicious input detected: Prototype pollution attempt rejected'));
  }

  if (req.query && detectPrototypePollution(req.query)) {
    return next(new BadRequestError('Malicious input detected: Prototype pollution attempt in query rejected'));
  }

  if (req.params && detectPrototypePollution(req.params)) {
    return next(new BadRequestError('Malicious input detected: Prototype pollution attempt in params rejected'));
  }

  next();
};

/**
 * Middleware to enforce application/json for state-changing HTTP methods with a request body.
 */
export const enforceContentType = (req: Request, res: Response, next: NextFunction): void => {
  const method = req.method.toUpperCase();
  const hasBody = req.headers['content-length'] && parseInt(req.headers['content-length'], 10) > 0;

  if (['POST', 'PUT', 'PATCH'].includes(method) && hasBody) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
      res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Unsupported Content-Type. Expected application/json',
          correlationId: req.correlationId || 'unknown',
        },
      });
      return;
    }
  }

  next();
};
