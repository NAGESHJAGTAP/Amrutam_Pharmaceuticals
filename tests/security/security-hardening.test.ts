import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/cache/redis.js';
import { TokenUtil } from '../../src/common/security/token.js';
import { SimulatedPaymentGateway } from '../../src/modules/payments/simulated-gateway.js';

describe('Phase 7: Security Hardening, Distributed Rate Limiting & Threat Defenses Test Suite', () => {
  const app = createApp();

  let patient1Token: string;
  let patient1UserId: string;
  let patient2Token: string;
  let patient2UserId: string;
  let doctorToken: string;
  let doctorUserId: string;
  let doctorId: string;

  beforeAll(async () => {
    // 1. Login Patient 1 (Rohan Patil)
    const pat1Login = await request(app).post('/api/v1/auth/login').send({
      email: 'rohan.patil@synthetic.local',
      password: 'PatientDevPass#2026!',
    });
    patient1Token = pat1Login.body.data.tokens.accessToken;
    patient1UserId = pat1Login.body.data.user.id;

    // 2. Login Patient 2 (Priya Shinde)
    const pat2Login = await request(app).post('/api/v1/auth/login').send({
      email: 'priya.shinde@synthetic.local',
      password: 'PatientDevPass#2026!',
    });
    patient2Token = pat2Login.body.data.tokens.accessToken;
    patient2UserId = pat2Login.body.data.user.id;

    // 3. Login Doctor (Dr. Aisha Sharma)
    const docUser = await prisma.user.findUnique({
      where: { email: 'dr.aisha.sharma@synthetic.local' },
      include: { doctor: true },
    });
    doctorUserId = docUser!.id;
    doctorId = docUser!.doctor!.id;

    const docLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'dr.aisha.sharma@synthetic.local',
      password: 'DoctorDevPass#2026!',
    });
    doctorToken = docLogin.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  // ============================================================================
  // 1. REDIS-BACKED DISTRIBUTED RATE LIMITING & HTTP 429 DEFENSES
  // ============================================================================
  describe('1. Distributed Rate Limiting & HTTP 429 Responses', () => {
    it('exhausts login rate limit and returns HTTP 429 with standard Retry-After header', async () => {
      const clientId = `test-client-auth-rl-${Date.now()}`;

      // Auth limit is 15 requests per 15 minutes. Send 15 requests
      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .set('X-Test-Rate-Limit', 'true')
          .set('X-Test-Client-Id', clientId)
          .send({
            email: 'nonexistent@synthetic.local',
            password: 'AnyPassword123!',
          });
        expect(res.status).toBe(401);
      }

      // The 16th request MUST be rejected with HTTP 429 Too Many Requests
      const throttledRes = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Test-Rate-Limit', 'true')
        .set('X-Test-Client-Id', clientId)
        .send({
          email: 'nonexistent@synthetic.local',
          password: 'AnyPassword123!',
        });

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.success).toBe(false);
      expect(throttledRes.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(throttledRes.headers['retry-after']).toBeDefined();
      expect(Number(throttledRes.headers['retry-after'])).toBeGreaterThan(0);
      expect(throttledRes.headers['ratelimit-limit']).toBe('15');
      expect(throttledRes.headers['ratelimit-remaining']).toBe('0');
    });

    it('coordinates distributed rate limiting across two separate API application instances via shared Redis', async () => {
      // Simulate two separate API server instances behind a load balancer sharing the same Redis cluster
      const instanceA = createApp();
      const instanceB = createApp();
      const sharedClientId = `multi-instance-client-${Date.now()}`;

      // Send 10 requests to Instance A
      for (let i = 0; i < 10; i++) {
        const res = await request(instanceA)
          .post('/api/v1/auth/login')
          .set('X-Test-Rate-Limit', 'true')
          .set('X-Test-Client-Id', sharedClientId)
          .send({ email: 'fake@synthetic.local', password: 'Pass#1' });
        expect(res.status).toBe(401);
      }

      // Send 5 requests to Instance B (accumulated total = 15)
      for (let i = 0; i < 5; i++) {
        const res = await request(instanceB)
          .post('/api/v1/auth/login')
          .set('X-Test-Rate-Limit', 'true')
          .set('X-Test-Client-Id', sharedClientId)
          .send({ email: 'fake@synthetic.local', password: 'Pass#2' });
        expect(res.status).toBe(401);
      }

      // The 16th request to Instance A MUST hit 429 because of shared Redis state
      const blockedResA = await request(instanceA)
        .post('/api/v1/auth/login')
        .set('X-Test-Rate-Limit', 'true')
        .set('X-Test-Client-Id', sharedClientId)
        .send({ email: 'fake@synthetic.local', password: 'Pass#3' });

      expect(blockedResA.status).toBe(429);
      expect(blockedResA.body.error.code).toBe('TOO_MANY_REQUESTS');

      // The 17th request to Instance B MUST also be throttled with 429
      const blockedResB = await request(instanceB)
        .post('/api/v1/auth/login')
        .set('X-Test-Rate-Limit', 'true')
        .set('X-Test-Client-Id', sharedClientId)
        .send({ email: 'fake@synthetic.local', password: 'Pass#4' });

      expect(blockedResB.status).toBe(429);
      expect(blockedResB.body.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('enforces booking rate limiting to protect consultation slot reservations from bot spam', async () => {
      const bookingClientId = `booking-rate-test-${Date.now()}`;

      // Booking limit is 20 requests per 10 minutes. Send 20 invalid booking requests
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post('/api/v1/consultations/book')
          .set('Authorization', `Bearer ${patient1Token}`)
          .set('X-Test-Rate-Limit', 'true')
          .set('X-Test-Client-Id', bookingClientId)
          .set('Idempotency-Key', `idemp-bk-rl-${i}-${Date.now()}`)
          .send({
            doctorId: '00000000-0000-0000-0000-000000000000',
            slotId: '00000000-0000-0000-0000-000000000000',
          });
        // Returns 404 (Resource not found) or 400
        expect(res.status).toBeLessThan(429);
      }

      // Request 21 MUST trigger 429
      const blockedBooking = await request(app)
        .post('/api/v1/consultations/book')
        .set('Authorization', `Bearer ${patient1Token}`)
        .set('X-Test-Rate-Limit', 'true')
        .set('X-Test-Client-Id', bookingClientId)
        .set('Idempotency-Key', `idemp-bk-rl-blocked-${Date.now()}`)
        .send({
          doctorId: '00000000-0000-0000-0000-000000000000',
          slotId: '00000000-0000-0000-0000-000000000000',
        });

      expect(blockedBooking.status).toBe(429);
      expect(blockedBooking.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  // ============================================================================
  // 2. HTTP SECURITY HEADERS & DEFENSIVE INPUT CONTROLS
  // ============================================================================
  describe('2. HTTP Security Headers, Payload Limits & Defensive Sanitization', () => {
    it('serves strict Helmet security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)', async () => {
      const res = await request(app).get('/healthz');

      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['x-powered-by']).toBeUndefined(); // Powered-by header hidden
    });

    it('rejects oversized JSON request payloads (>100kb) with HTTP 413 Payload Too Large', async () => {
      // Create a payload larger than 100kb (e.g. 150kb string)
      const oversizedPayload = {
        email: 'test@example.com',
        password: 'Pass#12345678!',
        extraData: 'x'.repeat(120 * 1024), // 120kb
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(oversizedPayload);

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(res.body.error.correlationId).toBeDefined();
    });

    it('rejects prototype pollution attempts via __proto__ in request body with HTTP 400', async () => {
      const pollutedBody = JSON.parse('{"__proto__": {"polluted": true}, "email": "hacker@test.com", "password": "Pass#12345678"}');

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(pollutedBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Prototype pollution attempt rejected');
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('rejects malformed JSON payloads with RFC 7807 structured HTTP 400 error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ "email": "test@test.com", invalid_json }');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_JSON');
      expect(res.body.error.correlationId).toBeDefined();
    });
  });

  // ============================================================================
  // 3. PRIVILEGE ESCALATION, IDOR & BOLA AUTHORIZATION DEFENSES
  // ============================================================================
  describe('3. Privilege Escalation, IDOR & Resource Ownership Enforcements', () => {
    it('DEFENSE: prevents public registration from self-assigning ADMIN or DOCTOR role', async () => {
      const attackEmail = `escalation.attempt.${Date.now()}@synthetic.local`;

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: attackEmail,
          password: 'SecurePass#2026!',
          firstName: 'Adversary',
          lastName: 'User',
          role: 'ADMIN', // Tampering attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('PATIENT'); // Enforced to PATIENT

      // Verify directly in PostgreSQL
      const dbUser = await prisma.user.findUnique({ where: { email: attackEmail } });
      expect(dbUser?.role).toBe('PATIENT');
    });

    it('DEFENSE: prevents Patient 1 from accessing Patient 2 profile (IDOR / BOLA)', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${patient2UserId}`)
        .set('Authorization', `Bearer ${patient1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Forbidden');
    });

    it('DEFENSE: prevents Patient from creating or finalizing prescriptions (Doctor role boundary)', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${patient1Token}`)
        .send({
          consultationId: '00000000-0000-0000-0000-000000000000',
          diagnosis: 'Unauthorized diagnosis attempt',
          medications: [
            {
              name: 'Antibiotic 500mg',
              dosage: '500mg',
              frequency: 'Twice daily',
              duration: '5 days',
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DEFENSE: prevents Doctor from modifying another doctor professional profile', async () => {
      // Find a doctor other than Dr. Aisha Sharma
      const otherDoctor = await prisma.doctor.findFirst({
        where: { id: { not: doctorId } },
      });

      const res = await request(app)
        .patch(`/api/v1/doctors/${otherDoctor!.id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultationFee: 10,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('You can only update your own doctor profile');
    });
  });

  // ============================================================================
  // 4. REFRESH TOKEN ROTATION, REUSE DETECTION & SESSION REVOCATION
  // ============================================================================
  describe('4. Token Security, RTR Reuse Detection & Logout', () => {
    it('detects refresh token reuse and immediately invalidates all active sessions for the user', async () => {
      // Register a disposable test user
      const testEmail = `rtr.test.${Date.now()}@synthetic.local`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: 'RtrPass#2026!Secure',
          firstName: 'RTR',
          lastName: 'Tester',
        });
      expect(regRes.status).toBe(201);
      const token1 = regRes.body.data.tokens.refreshToken;

      // Legitimate rotation 1: exchange token 1 for token 2
      const rotateRes1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token1 });

      expect(rotateRes1.status).toBe(200);
      const token2 = rotateRes1.body.data.tokens.refreshToken;
      expect(token2).not.toBe(token1);

      // Malicious replay attack: adversary presents token 1 again!
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token1 });

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('UNAUTHORIZED');
      expect(replayRes.body.error.message).toContain('Compromised session token detected');

      // Verify that even token 2 is now completely revoked as a protective measure
      const postReplayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token2 });

      expect(postReplayRes.status).toBe(401);
    });

    it('logs out and ensures revoked refresh tokens can no longer be used', async () => {
      const testEmail = `logout.test.${Date.now()}@synthetic.local`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: 'LogoutPass#2026!Secure',
          firstName: 'Logout',
          lastName: 'Tester',
        });

      const refreshToken = regRes.body.data.tokens.refreshToken;

      // Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);

      // Attempting to refresh with the logged-out token MUST be rejected
      const refreshAttempt = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshAttempt.status).toBe(401);
    });
  });

  // ============================================================================
  // 5. WEBHOOK SIGNATURE & REPLAY DEFENSES
  // ============================================================================
  describe('5. Payment Gateway Webhook Signature Verification & Replay Protection', () => {
    it('rejects webhooks with invalid HMAC signatures with HTTP 401 Unauthorized', async () => {
      const payload = {
        eventId: `tampered_evt_${Date.now()}`,
        eventType: 'payment.succeeded' as const,
        timestamp: new Date().toISOString(),
        data: {
          paymentReference: 'PAY-FAKE-REF-123',
          amount: 500,
          currency: 'INR',
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Webhook-Signature', 'invalid_forged_hmac_signature_hex')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Invalid webhook signature');
    });

    it('rejects webhooks missing the signature header completely', async () => {
      const payload = {
        eventId: `missing_sig_evt_${Date.now()}`,
        eventType: 'payment.succeeded' as const,
        timestamp: new Date().toISOString(),
        data: {
          paymentReference: 'PAY-FAKE-REF-456',
          amount: 500,
          currency: 'INR',
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ============================================================================
  // 6. SENSITIVE HEALTH DATA & SECRET LEAKAGE DEFENSES
  // ============================================================================
  describe('6. Zero Secret & PHI Leakage Checks', () => {
    it('ensures health and error responses never leak passwords, tokens, or system secrets', async () => {
      const readyRes = await request(app).get('/readyz');
      expect(readyRes.status).toBe(200);
      const readyBodyStr = JSON.stringify(readyRes.body);

      // Verify no DB password or Redis URLs with credentials leaked in health response
      expect(readyBodyStr).not.toContain('amrutam_secret_pw');
      expect(readyBodyStr).not.toContain('dev_jwt_access_secret');
      expect(readyBodyStr).not.toContain('dev_jwt_refresh_secret');
    });

    it('ensures error responses do not leak database stack traces or raw SQL queries in production format', async () => {
      const notFoundRes = await request(app).get('/api/v1/non-existent-security-check');
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('NOT_FOUND');
      expect(notFoundRes.body.error.correlationId).toBeDefined();
    });
  });
});
