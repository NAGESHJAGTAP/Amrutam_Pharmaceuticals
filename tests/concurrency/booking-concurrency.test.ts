import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/cache/redis.js';

describe('Phase 4: Concurrency, Idempotency & Booking Engine Test Suite', () => {
  const app = createApp();

  let doctorUserId: string;
  let doctorId: string;
  let doctorToken: string;
  let patient1Token: string;
  let patient1UserId: string;
  let patient2Token: string;
  let patient2UserId: string;
  let patientTokens: string[] = [];

  beforeAll(async () => {
    // 1. Fetch seeded doctor (Dr. Aisha Sharma)
    const doctorUser = await prisma.user.findUnique({
      where: { email: 'dr.aisha.sharma@synthetic.local' },
      include: { doctor: true },
    });
    doctorUserId = doctorUser!.id;
    doctorId = doctorUser!.doctor!.id;

    // Login as Doctor
    const docLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'dr.aisha.sharma@synthetic.local',
      password: 'DoctorDevPass#2026!',
    });
    doctorToken = docLogin.body.data.tokens.accessToken;

    // 2. Login as Seeded Patients
    const pat1Login = await request(app).post('/api/v1/auth/login').send({
      email: 'rohan.patil@synthetic.local',
      password: 'PatientDevPass#2026!',
    });
    patient1Token = pat1Login.body.data.tokens.accessToken;
    patient1UserId = pat1Login.body.data.user.id;

    const pat2Login = await request(app).post('/api/v1/auth/login').send({
      email: 'priya.shinde@synthetic.local',
      password: 'PatientDevPass#2026!',
    });
    patient2Token = pat2Login.body.data.tokens.accessToken;
    patient2UserId = pat2Login.body.data.user.id;

    // 3. Register 3 extra concurrent patients for race condition stress testing
    patientTokens = [patient1Token, patient2Token];
    for (let i = 3; i <= 5; i++) {
      const reg = await request(app).post('/api/v1/auth/register').send({
        email: `stress.patient.${i}.${Date.now()}@example.com`,
        password: 'StrongPassword#2026!',
        firstName: `Stress${i}`,
        lastName: 'Patient',
      });
      patientTokens.push(reg.body.data.tokens.accessToken);
    }

    // Clean up test-created records from any previous runs for this doctor (keep seed slots for tomorrow)
    const testCutoff = new Date();
    testCutoff.setDate(testCutoff.getDate() + 3);

    await prisma.idempotencyRecord.deleteMany({});
    await prisma.payment.deleteMany({
      where: { consultation: { doctorId, startTime: { gte: testCutoff } } },
    });
    await prisma.consultation.deleteMany({
      where: { doctorId, startTime: { gte: testCutoff } },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { doctorId, startTime: { gte: testCutoff } },
    });
  });

  afterAll(async () => {
    const testCutoff = new Date();
    testCutoff.setDate(testCutoff.getDate() + 3);

    await prisma.idempotencyRecord.deleteMany({});
    await prisma.payment.deleteMany({
      where: { consultation: { doctorId, startTime: { gte: testCutoff } } },
    });
    await prisma.consultation.deleteMany({
      where: { doctorId, startTime: { gte: testCutoff } },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { doctorId, startTime: { gte: testCutoff } },
    });
    await prisma.$disconnect();
    await redis.quit();
  });

  // ==========================================
  // 1. DOCTOR SEARCH & FILTERING
  // ==========================================
  describe('1. Doctor Search & Filtering', () => {
    it('searches doctors by specialty with case-insensitive partial match', async () => {
      const res = await request(app)
        .get('/api/v1/doctors')
        .query({ specialty: 'ayurveda' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.doctors.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination).toHaveProperty('total');
    });

    it('filters doctors by maxFee and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/doctors')
        .query({ maxFee: 700, page: 1, limit: 2 });

      expect(res.status).toBe(200);
      res.body.data.doctors.forEach((doc: any) => {
        expect(doc.consultationFee).toBeLessThanOrEqual(700);
      });
      expect(res.body.data.doctors.length).toBeLessThanOrEqual(2);
    });

    it('retrieves single doctor profile with upcoming available slots', async () => {
      const res = await request(app).get(`/api/v1/doctors/${doctorId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(doctorId);
      expect(res.body.data).toHaveProperty('availableSlots');
      expect(Array.isArray(res.body.data.availableSlots)).toBe(true);
    });
  });

  // ==========================================
  // 2. AVAILABILITY MANAGEMENT & INTERVAL OVERLAP PROTECTION
  // ==========================================
  describe('2. Availability Slot Creation & Interval Overlap Prevention', () => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 10); // 10 days in future
    baseDate.setUTCHours(10, 0, 0, 0);

    const slotAStart = new Date(baseDate);
    const slotAEnd = new Date(baseDate);
    slotAEnd.setUTCMinutes(30); // 10:00 - 10:30 UTC

    it('doctor creates a valid non-overlapping availability slot', async () => {
      const res = await request(app)
        .post('/api/v1/availability/slots')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          doctorId,
          startTime: slotAStart.toISOString(),
          endTime: slotAEnd.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.slot.doctorId).toBe(doctorId);
      expect(res.body.data.slot.status).toBe('AVAILABLE');
    });

    it('DEFENSE: rejects slot creation that overlaps with an existing slot interval', async () => {
      // Slot B overlaps by 15 minutes: 10:15 - 10:45 UTC
      const overlapStart = new Date(baseDate);
      overlapStart.setUTCMinutes(15);
      const overlapEnd = new Date(baseDate);
      overlapEnd.setUTCMinutes(45);

      const res = await request(app)
        .post('/api/v1/availability/slots')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          doctorId,
          startTime: overlapStart.toISOString(),
          endTime: overlapEnd.toISOString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/overlap/i);
    });

    it('DEFENSE: PostgreSQL-level exclusion constraint defeats simultaneous concurrent overlapping requests', async () => {
      // 2 parallel requests attempt to create the EXACT same interval at the exact same moment
      const concurrentStart = new Date(baseDate);
      concurrentStart.setUTCHours(11, 0, 0, 0);
      const concurrentEnd = new Date(baseDate);
      concurrentEnd.setUTCHours(11, 30, 0, 0);

      const reqPayload = {
        doctorId,
        startTime: concurrentStart.toISOString(),
        endTime: concurrentEnd.toISOString(),
      };

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/availability/slots')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(reqPayload),
        request(app)
          .post('/api/v1/availability/slots')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(reqPayload),
      ]);

      const statuses = [res1.status, res2.status];
      // Exactly ONE must succeed (201) and the other must be rejected with 409 Conflict
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);
    });

    it('rejects slot creation with invalid time order (startTime >= endTime)', async () => {
      const res = await request(app)
        .post('/api/v1/availability/slots')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          doctorId,
          startTime: '2026-11-15T15:00:00.000Z',
          endTime: '2026-11-15T14:00:00.000Z', // Inverted!
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unauthorized patient attempting to create doctor availability slot', async () => {
      const res = await request(app)
        .post('/api/v1/availability/slots')
        .set('Authorization', `Bearer ${patient1Token}`) // Patient role
        .send({
          doctorId,
          startTime: '2026-11-16T10:00:00.000Z',
          endTime: '2026-11-16T10:30:00.000Z',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // 3. CONCURRENCY: SIMULTANEOUS DOUBLE-BOOKING PROTECTION
  // ==========================================
  describe('3. Concurrency Protection: Anti-Double-Booking Guarantee', () => {
    let targetSlotId: string;

    beforeAll(async () => {
      // Create a fresh single-capacity slot for stress testing
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      futureDate.setUTCHours(16, 0, 0, 0);

      const slot = await prisma.availabilitySlot.create({
        data: {
          doctorId,
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 1800000), // 30 mins
          status: 'AVAILABLE',
        },
      });
      targetSlotId = slot.id;
    });

    it('SIMULTANEOUS RACE CONDITION: 5 parallel requests compete for 1 slot -> EXACTLY 1 succeeds, 4 receive 409 Conflict', async () => {
      // 5 distinct patients fire simultaneous booking requests for targetSlotId
      const promises = patientTokens.map((token, index) => {
        return request(app)
          .post('/api/v1/consultations/book')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `STRESS-BOOK-${Date.now()}-P${index}`)
          .send({
            doctorId,
            slotId: targetSlotId,
            reason: `Urgent race condition consultation attempt by patient ${index}`,
          });
      });

      const responses = await Promise.all(promises);

      const successResponses = responses.filter((r) => r.status === 201);
      const conflictResponses = responses.filter((r) => r.status === 409);

      // RIGOROUS CONCURRENCY PROOF:
      // Exactly 1 request successfully acquired the lock and created the booking
      expect(successResponses.length).toBe(1);
      // All other concurrent requests were cleanly rejected with 409 Conflict
      expect(conflictResponses.length).toBe(4);

      // Verify PostgreSQL database state:
      // Exactly 1 consultation row exists in PostgreSQL for this slot
      const bookingsInDb = await prisma.consultation.findMany({
        where: { slotId: targetSlotId },
      });
      expect(bookingsInDb.length).toBe(1);

      // Verify slot is marked as RESERVED
      const slotInDb = await prisma.availabilitySlot.findUnique({
        where: { id: targetSlotId },
      });
      expect(slotInDb?.status).toBe('RESERVED');
    });
  });

  // ==========================================
  // 4. DATABASE-BACKED IDEMPOTENCY
  // ==========================================
  describe('4. Database-Backed Idempotency Engine', () => {
    let freshSlotId: string;
    const idempotencyKey = `IDEM-KEY-${Date.now()}-ALPHA`;

    beforeAll(async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 16);
      futureDate.setUTCHours(10, 0, 0, 0);

      const slot = await prisma.availabilitySlot.create({
        data: {
          doctorId,
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 1800000),
          status: 'AVAILABLE',
        },
      });
      freshSlotId = slot.id;
    });

    it('first request with Idempotency-Key succeeds with 201 Created', async () => {
      const res = await request(app)
        .post('/api/v1/consultations/book')
        .set('Authorization', `Bearer ${patient1Token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          doctorId,
          slotId: freshSlotId,
          reason: 'Initial idempotent booking request',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.consultation).toHaveProperty('id');
    });

    it('IDEMPOTENT REPLAY: retry with SAME key and SAME payload replays original response without duplicate write', async () => {
      const res = await request(app)
        .post('/api/v1/consultations/book')
        .set('Authorization', `Bearer ${patient1Token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          doctorId,
          slotId: freshSlotId,
          reason: 'Initial idempotent booking request', // Identical payload
        });

      expect(res.status).toBe(201);
      expect(res.headers['x-cache-lookup']).toBe('IDEMPOTENT_HIT');
      expect(res.body.data.consultation).toHaveProperty('id');

      // Verify that no second consultation was created in PostgreSQL
      const totalBookingsForSlot = await prisma.consultation.count({
        where: { slotId: freshSlotId },
      });
      expect(totalBookingsForSlot).toBe(1);
    });

    it('DEFENSE: reusing SAME Idempotency-Key with a DIFFERENT payload returns 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/consultations/book')
        .set('Authorization', `Bearer ${patient1Token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          doctorId,
          slotId: freshSlotId,
          reason: 'TAMPERED PAYLOAD! Different reason!', // Altered payload!
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('different request payload');
    });

    it('rejects booking when Idempotency-Key header is missing', async () => {
      const res = await request(app)
        .post('/api/v1/consultations/book')
        .set('Authorization', `Bearer ${patient1Token}`)
        // No Idempotency-Key header!
        .send({
          doctorId,
          slotId: freshSlotId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Idempotency-Key header is required');
    });
  });

  // ==========================================
  // 5. CANCELLATION & SLOT STATE TRANSITIONS
  // ==========================================
  describe('5. Cancellation Workflow & Consistency', () => {
    let cancelSlotId: string;
    let consultationId: string;

    beforeAll(async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);
      futureDate.setUTCHours(14, 0, 0, 0);

      const slot = await prisma.availabilitySlot.create({
        data: {
          doctorId,
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 1800000),
          status: 'AVAILABLE',
        },
      });
      cancelSlotId = slot.id;

      // Patient 1 books the slot
      const bookRes = await request(app)
        .post('/api/v1/consultations/book')
        .set('Authorization', `Bearer ${patient1Token}`)
        .set('Idempotency-Key', `CANCEL-PREP-${Date.now()}`)
        .send({
          doctorId,
          slotId: cancelSlotId,
          reason: 'Booking to test cancellation workflow',
        });

      consultationId = bookRes.body.data.consultation.id;
    });

    it('DEFENSE: Patient 2 is forbidden from cancelling Patient 1 consultation', async () => {
      const res = await request(app)
        .post(`/api/v1/consultations/${consultationId}/cancel`)
        .set('Authorization', `Bearer ${patient2Token}`) // Different patient
        .set('Idempotency-Key', `UNAUTH-CANCEL-${Date.now()}`)
        .send({ reason: 'Malicious cancellation attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Patient 1 to cancel their consultation, resetting slot state to AVAILABLE', async () => {
      const res = await request(app)
        .post(`/api/v1/consultations/${consultationId}/cancel`)
        .set('Authorization', `Bearer ${patient1Token}`)
        .set('Idempotency-Key', `PATIENT1-CANCEL-${Date.now()}`)
        .send({ reason: 'Patient schedule conflict' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.consultation.status).toBe('CANCELLED');

      // Verify that the slot has safely returned to AVAILABLE status in the database
      const slotInDb = await prisma.availabilitySlot.findUnique({
        where: { id: cancelSlotId },
      });
      expect(slotInDb?.status).toBe('AVAILABLE');
    });

    it('allows another patient (Patient 2) to book the newly freed slot', async () => {
      // Re-booking the freed slot must now succeed cleanly!
      const res = await request(app)
        .post('/api/v1/consultations/book')
        .set('Authorization', `Bearer ${patient2Token}`)
        .set('Idempotency-Key', `PATIENT2-REBOOK-${Date.now()}`)
        .send({
          doctorId,
          slotId: cancelSlotId,
          reason: 'Patient 2 booking the freed slot',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.consultation.status).toBe('SCHEDULED');
    });
  });
});
