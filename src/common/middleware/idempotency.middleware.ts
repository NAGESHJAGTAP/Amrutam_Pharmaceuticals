import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ConflictError, BadRequestError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

/**
 * Database-backed idempotency middleware for state-modifying requests.
 * Uses the Idempotency-Key header to ensure atomic, exactly-once execution semantics.
 */
export const requireIdempotency = (operationName: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    // If no key provided, write operations fail fast to prevent non-idempotent mutations
    if (!idempotencyKey) {
      return next(
        new BadRequestError('Idempotency-Key header is required for this operation')
      );
    }

    if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
      return next(new BadRequestError('Idempotency-Key must be between 8 and 255 characters'));
    }

    const actorId = req.user?.sub || 'anonymous';
    // Compute deterministic SHA-256 hash of payload + method + path
    const normalizedPayload = JSON.stringify(req.body || {});
    const requestHash = crypto
      .createHash('sha256')
      .update(`${req.method}:${req.path}:${normalizedPayload}`)
      .digest('hex');

    try {
      // 1. Check for existing idempotency record
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey },
      });

      if (existingRecord) {
        // Validation: Verify if payload matches the original request
        if (existingRecord.requestHash !== requestHash) {
          logger.warn(
            { idempotencyKey, actorId, correlationId: req.correlationId },
            'Idempotency key reused with mismatched request payload'
          );
          return next(
            new ConflictError(
              'Idempotency-Key was already used with a different request payload or endpoint'
            )
          );
        }

        // If the original operation completed successfully, replay the cached response
        if (existingRecord.responseStatus !== null && existingRecord.responseBody !== null) {
          logger.info(
            { idempotencyKey, status: existingRecord.responseStatus },
            'Replaying cached response for idempotent request'
          );

          res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
          res.setHeader('Idempotency-Key', idempotencyKey);
          res.status(existingRecord.responseStatus).json(existingRecord.responseBody);
          return;
        }

        // If operation is still in-progress within lock window
        if (existingRecord.lockedUntil > new Date()) {
          return next(
            new ConflictError(
              'A concurrent request with this Idempotency-Key is currently in progress. Please retry after a few seconds.'
            )
          );
        }
      }

      // 2. Acquire or refresh in-progress lock in database
      const lockDurationMs = 30000; // 30 seconds lock
      const lockedUntil = new Date(Date.now() + lockDurationMs);

      await prisma.idempotencyRecord.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          actorId,
          operation: operationName,
          requestHash,
          lockedUntil,
        },
        update: {
          lockedUntil,
        },
      });

      // 3. Intercept res.json to persist the response upon successful execution
      const originalJson = res.json.bind(res);
      res.json = (body: any): Response => {
        // Save the response asynchronously so client is not delayed
        if (res.statusCode >= 200 && res.statusCode < 300) {
          prisma.idempotencyRecord
            .update({
              where: { idempotencyKey },
              data: {
                responseStatus: res.statusCode,
                responseBody: body,
              },
            })
            .catch((err) => {
              logger.error({ err, idempotencyKey }, 'Failed to persist idempotency response body');
            });
        } else {
          // If the request failed with 4xx or 5xx, remove the lock so user can retry cleanly
          prisma.idempotencyRecord.delete({ where: { idempotencyKey } }).catch(() => {});
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
