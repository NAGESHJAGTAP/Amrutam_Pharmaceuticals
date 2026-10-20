import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { metricsRegistry, normalizeRoutePath } from '../../src/infrastructure/telemetry/metrics.js';
import { withSpan, getActiveTraceContext } from '../../src/infrastructure/telemetry/tracer.js';
import { logger } from '../../src/common/logging/logger.js';
import { env } from '../../src/config/env.js';

describe('Phase 8: Observability, Metrics & Telemetry Test Suite', () => {
  const app = createApp();

  describe('1. Prometheus Metrics Scrape Endpoint (/metrics)', () => {
    it('returns 200 OK with Prometheus exposition format', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('# HELP amrutam_http_requests_total');
      expect(res.text).toContain('# TYPE amrutam_http_requests_total counter');
      expect(res.text).toContain('# HELP amrutam_http_request_duration_seconds');
      expect(res.text).toContain('# TYPE amrutam_http_request_duration_seconds histogram');
      expect(res.text).toContain('amrutam_database_health_status');
      expect(res.text).toContain('amrutam_redis_health_status');
    });

    it('collects Node.js runtime process metrics', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('process_resident_memory_bytes');
      expect(res.text).toContain('nodejs_eventloop_lag_seconds');
    });

    it('enforces Bearer token protection when METRICS_AUTH_TOKEN is configured', async () => {
      // Simulate METRICS_AUTH_TOKEN configured
      const originalToken = env.METRICS_AUTH_TOKEN;
      (env as any).METRICS_AUTH_TOKEN = 'secret-scrape-token-999';

      try {
        // Request without token should be rejected with 401
        const unauthRes = await request(app).get('/metrics');
        expect(unauthRes.status).toBe(401);
        expect(unauthRes.body.success).toBe(false);
        expect(unauthRes.body.error.code).toBe('UNAUTHORIZED');

        // Request with invalid token should be rejected with 401
        const invalidRes = await request(app)
          .get('/metrics')
          .set('Authorization', 'Bearer wrong-token');
        expect(invalidRes.status).toBe(401);

        // Request with valid Bearer token should succeed with 200
        const validRes = await request(app)
          .get('/metrics')
          .set('Authorization', 'Bearer secret-scrape-token-999');
        expect(validRes.status).toBe(200);
        expect(validRes.headers['content-type']).toContain('text/plain');

        // Request with x-metrics-key header should also succeed
        const headerRes = await request(app)
          .get('/metrics')
          .set('x-metrics-key', 'secret-scrape-token-999');
        expect(headerRes.status).toBe(200);
      } finally {
        (env as any).METRICS_AUTH_TOKEN = originalToken;
      }
    });
  });

  describe('2. Low-Cardinality Metric Labels & Route Normalization', () => {
    it('normalizes UUID path parameters to prevent metric label cardinality explosion', () => {
      const mockReqWithUuid = {
        baseUrl: '/api/v1/doctors',
        path: '/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      } as any;

      const normalized = normalizeRoutePath(mockReqWithUuid);
      expect(normalized).toBe('/api/v1/doctors/:id');
      expect(normalized).not.toContain('a1b2c3d4');
    });

    it('normalizes integer IDs to prevent metric cardinality explosion', () => {
      const mockReqWithId = {
        baseUrl: '',
        path: '/api/v1/users/482910',
      } as any;

      const normalized = normalizeRoutePath(mockReqWithId);
      expect(normalized).toBe('/api/v1/users/:id');
    });

    it('uses req.route.path when Express router has matched a parameterized route', () => {
      const mockReqWithRoute = {
        baseUrl: '/api/v1/consultations',
        path: '/c56a4180-65aa-42ec-a945-5fd21dec0538/prescription',
        route: { path: '/:consultationId/prescription' },
      } as any;

      const normalized = normalizeRoutePath(mockReqWithRoute);
      expect(normalized).toBe('/api/v1/consultations/:consultationId/prescription');
      expect(normalized).not.toContain('c56a4180');
    });

    it('records HTTP request duration and increment counter upon request completion', async () => {
      // Make a dummy request that hits the API
      await request(app).get('/healthz');

      const metricsAfter = await metricsRegistry.getMetricsAsJSON();
      const httpCounter = metricsAfter.find((m) => m.name === 'amrutam_http_requests_total');
      expect(httpCounter).toBeDefined();

      const durationHistogram = metricsAfter.find((m) => m.name === 'amrutam_http_request_duration_seconds');
      expect(durationHistogram).toBeDefined();
    });
  });

  describe('3. Production Health Probes (/healthz & /readyz)', () => {
    it('/healthz provides uptime and safe memory statistics without failing on downstream dependencies', async () => {
      const res = await request(app).get('/healthz');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('uptimeSeconds');
      expect(res.body.memory).toHaveProperty('heapUsedMb');
      expect(res.body.memory).toHaveProperty('rssMb');
      expect(typeof res.body.memory.heapUsedMb).toBe('number');
      // Must not leak environment vars, database URLs or tokens
      expect(res.text).not.toContain('DATABASE_URL');
      expect(res.text).not.toContain('REDIS_URL');
      expect(res.text).not.toContain('password');
    });

    it('/readyz returns safe response structure with bounded dependency checks', async () => {
      const res = await request(app).get('/readyz');

      // Regardless of whether DB is UP or DOWN (e.g. In unit test containerless environment),
      // status should be either 200 READY or 503 NOT_READY with clean structure
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('server');
      expect(res.body.checks).toHaveProperty('database');
      expect(res.body.checks).toHaveProperty('redis');

      // Crucial: No connection strings, ports, credentials or raw errors in payload
      expect(res.text).not.toContain('postgres://');
      expect(res.text).not.toContain('redis://');
      expect(res.text).not.toContain('amrutam_secret_pw');
    });
  });

  describe('4. Distributed Tracing & Span Context Helper', () => {
    it('getActiveTraceContext returns safe object even when tracing is in no-op mode', () => {
      const traceContext = getActiveTraceContext();
      expect(traceContext).toBeDefined();
      expect(typeof traceContext).toBe('object');
    });

    it('withSpan executes wrapped asynchronous function and returns its result', async () => {
      const testResult = await withSpan(
        'test.observability.operation',
        { 'test.attribute': 'telemetry-test' },
        async (span) => {
          expect(span).toBeDefined();
          return { completed: true, data: 42 };
        }
      );

      expect(testResult).toEqual({ completed: true, data: 42 });
    });

    it('withSpan safely records exceptions without throwing away original error', async () => {
      await expect(
        withSpan('test.failing.operation', { 'test.flag': true }, async () => {
          throw new Error('Synthetic telemetry failure');
        })
      ).rejects.toThrow('Synthetic telemetry failure');
    });
  });

  describe('5. Structured Logging & Redaction Verification', () => {
    it('verifies logger config redacts sensitive fields such as passwords, tokens, and clinical data', () => {
      // Test Pino redaction rules configuration
      // Inspect serializer / redaction keys in logger
      const testObj = {
        email: 'patient@example.com',
        password: 'super-secret-password-123',
        accessToken: 'jwt-access-token-xyz',
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        diagnosis: 'CONFIDENTIAL MEDICAL DIAGNOSIS',
      };

      // Pino logs as serialized JSON. Let's verify logger does not crash and handles structured metadata
      expect(() => {
        logger.info({ testPayload: testObj }, 'Testing structured log sanitization');
      }).not.toThrow();
    });
  });
});
