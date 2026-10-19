import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../../src/app.js';
import { z } from 'zod';
import { validate } from '../../src/common/middleware/validate.middleware.js';
import { errorHandlerMiddleware } from '../../src/common/middleware/error-handler.middleware.js';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware.js';

describe('Application Foundation & Health Probes', () => {
  const app = createApp();

  it('GET /healthz returns 200 OK with UP status', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /readyz returns 200 OK with READY status', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.checks.server).toBe('UP');
  });

  it('GET /non-existent-route returns 404 NOT_FOUND structured error', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.correlationId).toBeDefined();
  });

  it('preserves existing X-Correlation-ID header if provided by client', async () => {
    const customCorrelationId = 'client-provided-corr-12345';
    const res = await request(app)
      .get('/healthz')
      .set('X-Correlation-ID', customCorrelationId);
    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBe(customCorrelationId);
  });

  afterAll(async () => {
    const { prisma } = await import('../../src/infrastructure/database/prisma.js');
    const { redis } = await import('../../src/infrastructure/cache/redis.js');
    await prisma.$disconnect();
    await redis.quit();
  });
});

describe('Validation Middleware & Error Handler', () => {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);

  const testSchema = {
    body: z.object({
      email: z.string().email(),
      age: z.number().min(18),
    }),
  };

  app.post('/test-validate', validate(testSchema), (_req, res) => {
    res.status(200).json({ success: true });
  });

  app.use(errorHandlerMiddleware);

  it('returns 422 VALIDATION_ERROR when payload is invalid', async () => {
    const res = await request(app)
      .post('/test-validate')
      .send({ email: 'not-an-email', age: 12 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveLength(2);
  });

  it('passes validation when payload is valid', async () => {
    const res = await request(app)
      .post('/test-validate')
      .send({ email: 'patient@example.com', age: 25 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
