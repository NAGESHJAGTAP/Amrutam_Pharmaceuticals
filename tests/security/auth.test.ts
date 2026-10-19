import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/cache/redis.js';
import { generateSync } from 'otplib';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';

describe('Phase 3 Security & Authentication Test Suite', () => {
  const app = createApp();

  const testPatient = {
    email: `patient.test.${Date.now()}@example.com`,
    password: 'StrongPassword#2026!',
    firstName: 'Arjun',
    lastName: 'Sharma',
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
  };

  let registeredPatientId: string;
  let accessToken: string;
  let refreshToken: string;

  afterAll(async () => {
    // Teardown connections cleanly
    await prisma.$disconnect();
    await redis.quit();
  });

  // ==========================================
  // 1. REGISTRATION & PRIVILEGE ESCALATION
  // ==========================================
  describe('1. Patient Registration & Privilege Escalation Defenses', () => {
    it('successfully registers a patient with Argon2id password hash in DB', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testPatient);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testPatient.email.toLowerCase());
      expect(res.body.data.user.role).toBe('PATIENT');
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');

      registeredPatientId = res.body.data.user.id;
      accessToken = res.body.data.tokens.accessToken;
      refreshToken = res.body.data.tokens.refreshToken;

      // Verify that plaintext password is NOT in database and Argon2id hash is stored
      const userInDb = await prisma.user.findUnique({
        where: { id: registeredPatientId },
      });
      expect(userInDb).not.toBeNull();
      expect(userInDb!.passwordHash).not.toBe(testPatient.password);
      expect(userInDb!.passwordHash).toMatch(/^\$argon2id\$/); // Strictly Argon2id
    });

    it('rejects duplicate email registration with 409 Conflict', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testPatient);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects weak password with 422 Validation Error', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'weakpass@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('DEFENSE: prevents privilege escalation when client tries to register as ADMIN or DOCTOR', async () => {
      const maliciousPayload = {
        email: `hacker.${Date.now()}@example.com`,
        password: 'HackerPassword#2026!',
        firstName: 'Malicious',
        lastName: 'Actor',
        role: 'ADMIN', // Attacker attempt to self-escalate to ADMIN
      };

      const res = await request(app).post('/api/v1/auth/register').send(maliciousPayload);

      expect(res.status).toBe(201);
      // The backend MUST force the role to PATIENT, completely ignoring client's role attempt
      expect(res.body.data.user.role).toBe('PATIENT');

      const dbUser = await prisma.user.findUnique({
        where: { email: maliciousPayload.email.toLowerCase() },
      });
      expect(dbUser?.role).toBe('PATIENT');
    });
  });

  // ==========================================
  // 2. LOGIN & CREDENTIAL VALIDATION
  // ==========================================
  describe('2. Login & Credential Security', () => {
    it('successfully logs in with valid credentials and receives tokens', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testPatient.email,
        password: testPatient.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mfaRequired).toBe(false);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');

      // Update tokens for subsequent tests
      accessToken = res.body.data.tokens.accessToken;
      refreshToken = res.body.data.tokens.refreshToken;
    });

    it('rejects incorrect password with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testPatient.email,
        password: 'WrongPassword#123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects non-existent email with generic 401 Unauthorized (defeats email enumeration)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nobody-exists-with-this-email@example.com',
        password: 'SomePassword#123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  // ==========================================
  // 3. TOKEN ROTATION & REUSE DETECTION
  // ==========================================
  describe('3. Refresh Token Rotation (RTR) & Reuse Detection', () => {
    let secondRefreshToken: string;

    it('successfully rotates refresh token and issues new token pair', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');
      expect(res.body.data.tokens.refreshToken).not.toBe(refreshToken); // Must be a new token

      secondRefreshToken = res.body.data.tokens.refreshToken;
    });

    it('DEFENSE: detects refresh token reuse and terminates all sessions', async () => {
      // Attacker attempts to replay the FIRST refresh token (which has already been rotated/revoked)
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken, // Old revoked token
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Compromised session token detected');

      // Verify that ALL refresh tokens for this user have now been marked as revoked
      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: registeredPatientId, isRevoked: false },
      });
      expect(activeTokens.length).toBe(0);

      // Verify that even the previously valid secondRefreshToken is now also revoked
      const secondRes = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: secondRefreshToken,
      });
      expect(secondRes.status).toBe(401);
    });

    it('rejects expired or forged access token', async () => {
      const expiredToken = jwt.sign(
        { sub: registeredPatientId, email: testPatient.email, role: 'PATIENT' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '-10s' } // Expired 10 seconds ago
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('expired');
    });
  });

  // ==========================================
  // 4. TOTP MULTI-FACTOR AUTHENTICATION (MFA)
  // ==========================================
  describe('4. Multi-Factor Authentication (TOTP RFC 6238)', () => {
    let mfaUserAccessToken: string;
    let mfaUserId: string;
    let mfaSecret: string;
    const mfaUser = {
      email: `mfa.user.${Date.now()}@example.com`,
      password: 'MfaUserPassword#2026!',
      firstName: 'Kavita',
      lastName: 'Patil',
    };

    beforeAll(async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(mfaUser);
      mfaUserId = reg.body.data.user.id;
      mfaUserAccessToken = reg.body.data.tokens.accessToken;
    });

    it('initiates MFA setup and returns TOTP secret and keyUri', async () => {
      const res = await request(app)
        .post('/api/v1/auth/mfa/setup')
        .set('Authorization', `Bearer ${mfaUserAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('secret');
      expect(res.body.data).toHaveProperty('keyUri');
      expect(res.body.data.keyUri).toContain('otpauth://totp/');

      mfaSecret = res.body.data.secret;
    });

    it('rejects invalid 6-digit TOTP code during MFA enrollment', async () => {
      const res = await request(app)
        .post('/api/v1/auth/mfa/verify-setup')
        .set('Authorization', `Bearer ${mfaUserAccessToken}`)
        .send({ code: '000000' }); // Invalid code

      expect(res.status).toBe(401);
    });

    it('verifies valid TOTP code and activates MFA on the account', async () => {
      // Generate authentic RFC 6238 TOTP code using otplib
      const validCode = generateSync({ secret: mfaSecret });

      const res = await request(app)
        .post('/api/v1/auth/mfa/verify-setup')
        .set('Authorization', `Bearer ${mfaUserAccessToken}`)
        .send({ code: validCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await prisma.user.findUnique({ where: { id: mfaUserId } });
      expect(dbUser?.mfaEnabled).toBe(true);
    });

    it('requires MFA challenge during login when MFA is enabled', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: mfaUser.email,
        password: mfaUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.mfaRequired).toBe(true);
      expect(res.body.data).toHaveProperty('mfaToken');
      expect(res.body.data.tokens).toBeUndefined(); // Sensitive full tokens are withheld

      const mfaToken = res.body.data.mfaToken;

      // Now complete MFA login with valid TOTP code
      const validCode = generateSync({ secret: mfaSecret });
      const verifyRes = await request(app)
        .post('/api/v1/auth/mfa/verify-login')
        .send({ mfaToken, code: validCode });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.tokens).toHaveProperty('accessToken');
      expect(verifyRes.body.data.tokens).toHaveProperty('refreshToken');
    });
  });

  // ==========================================
  // 5. RBAC & RESOURCE OWNERSHIP ON PROFILES
  // ==========================================
  describe('5. RBAC & Resource Ownership on User Profiles', () => {
    let patientAId: string;
    let patientAToken: string;
    let patientBId: string;
    let patientBToken: string;
    let adminToken: string;

    beforeAll(async () => {
      // 1. Register Patient A
      const regA = await request(app).post('/api/v1/auth/register').send({
        email: `patient.a.${Date.now()}@example.com`,
        password: 'PassForPatientA#2026!',
        firstName: 'Alice',
        lastName: 'Patient',
      });
      patientAId = regA.body.data.user.id;
      patientAToken = regA.body.data.tokens.accessToken;

      // 2. Register Patient B
      const regB = await request(app).post('/api/v1/auth/register').send({
        email: `patient.b.${Date.now()}@example.com`,
        password: 'PassForPatientB#2026!',
        firstName: 'Bob',
        lastName: 'Patient',
      });
      patientBId = regB.body.data.user.id;
      patientBToken = regB.body.data.tokens.accessToken;

      // 3. Log in as Seeded Admin
      const adminLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'admin.amrutam@synthetic.local',
        password: 'AdminDevPass#2026!',
      });
      adminToken = adminLogin.body.data.tokens.accessToken;
    });

    it('allows Patient A to retrieve their own profile', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${patientAId}`)
        .set('Authorization', `Bearer ${patientAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(patientAId);
      expect(res.body.data.profile.firstName).toBe('Alice');
    });

    it('DEFENSE: rejects Patient A attempting to view Patient B profile with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${patientBId}`) // Cross-user profile access attempt
        .set('Authorization', `Bearer ${patientAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DEFENSE: rejects Patient A attempting to update Patient B profile with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/profiles/${patientBId}`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({ firstName: 'TamperedName' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Admin to view any user profile under RBAC', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${patientAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(patientAId);
    });

    it('allows Patient A to update their own profile fields', async () => {
      const res = await request(app)
        .patch(`/api/v1/profiles/${patientAId}`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({
          gender: 'Female',
          emergencyContact: '+919876543210',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.profile.gender).toBe('Female');
      expect(res.body.data.profile.emergencyContact).toBe('+919876543210');
    });
  });
});
