import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/cache/redis.js';
import { SimulatedPaymentGateway } from '../../src/modules/payments/simulated-gateway.js';

describe('Phase 5: Prescription Management & Payment Processing Test Suite', () => {
  const app = createApp();

  let doctor1UserId: string;
  let doctor1Id: string;
  let doctor1Token: string;

  let doctor2UserId: string;
  let doctor2Id: string;
  let doctor2Token: string;

  let patient1UserId: string;
  let patient1Token: string;

  let patient2UserId: string;
  let patient2Token: string;

  let consultationId: string;
  let paymentReference: string;
  let paymentId: string;

  beforeAll(async () => {
    // 1. Login Seeded Doctor 1 (Dr. Aisha Sharma)
    const doc1 = await prisma.user.findUnique({
      where: { email: 'dr.aisha.sharma@synthetic.local' },
      include: { doctor: true },
    });
    doctor1UserId = doc1!.id;
    doctor1Id = doc1!.doctor!.id;

    const doc1Login = await request(app).post('/api/v1/auth/login').send({
      email: 'dr.aisha.sharma@synthetic.local',
      password: 'DoctorDevPass#2026!',
    });
    doctor1Token = doc1Login.body.data.tokens.accessToken;

    // 2. Login Seeded Doctor 2 (Dr. Rajesh Kulkarni)
    const doc2 = await prisma.user.findUnique({
      where: { email: 'dr.rajesh.kulkarni@synthetic.local' },
      include: { doctor: true },
    });
    doctor2UserId = doc2!.id;
    doctor2Id = doc2!.doctor!.id;

    const doc2Login = await request(app).post('/api/v1/auth/login').send({
      email: 'dr.rajesh.kulkarni@synthetic.local',
      password: 'DoctorDevPass#2026!',
    });
    doctor2Token = doc2Login.body.data.tokens.accessToken;

    // 3. Login Seeded Patients
    const pat1Login = await request(app).post('/api/v1/auth/login').send({
      email: 'rohan.patil@synthetic.local',
      password: 'PatientDevPass#2026!',
    });
    patient1UserId = pat1Login.body.data.user.id;
    patient1Token = pat1Login.body.data.tokens.accessToken;

    const pat2Login = await request(app).post('/api/v1/auth/login').send({
      email: 'priya.shinde@synthetic.local',
      password: 'PatientDevPass#2026!',
    });
    patient2UserId = pat2Login.body.data.user.id;
    patient2Token = pat2Login.body.data.tokens.accessToken;

    // Clean up any test records
    await prisma.webhookEvent.deleteMany({});

    // 4. Create an isolated consultation for testing
    const testSlotDate = new Date('2028-06-01T10:00:00.000Z');
    await prisma.availabilitySlot.deleteMany({
      where: { startTime: testSlotDate },
    });

    const slot = await prisma.availabilitySlot.create({
      data: {
        doctorId: doctor1Id,
        startTime: testSlotDate,
        endTime: new Date('2028-06-01T10:30:00.000Z'),
        status: 'AVAILABLE',
      },
    });

    const bookRes = await request(app)
      .post('/api/v1/consultations/book')
      .set('Authorization', `Bearer ${patient1Token}`)
      .set('Idempotency-Key', `PHASE5-INIT-BOOK-${Date.now()}`)
      .send({
        doctorId: doctor1Id,
        slotId: slot.id,
        reason: 'Chronic indigestion and fatigue',
      });

    expect(bookRes.status).toBe(201);
    consultationId = bookRes.body.data.consultation.id;
    paymentReference = bookRes.body.data.consultation.payment.paymentReference;
    paymentId = bookRes.body.data.consultation.payment.id;
  });

  afterAll(async () => {
    // Teardown test artifacts
    await prisma.webhookEvent.deleteMany({});
    await prisma.prescription.deleteMany({
      where: { consultationId },
    });
    await prisma.payment.deleteMany({
      where: { consultationId },
    });
    await prisma.consultation.deleteMany({
      where: { id: consultationId },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { startTime: new Date('2028-06-01T10:00:00.000Z') },
    });

    await prisma.$disconnect();
    await redis.quit();
  });

  // ==========================================
  // 1. PRESCRIPTION LIFECYCLE & AUTHORIZATION
  // ==========================================
  describe('1. Prescription Lifecycle & Authorization', () => {
    let prescriptionId: string;

    const validMedications = [
      {
        name: 'Triphala Churna',
        dosage: '1 teaspoon (5g)',
        frequency: 'Once daily before bed',
        duration: '30 days',
        instructions: 'Take with warm water',
      },
      {
        name: 'Avipattikar Churna',
        dosage: '1/2 teaspoon',
        frequency: 'Twice daily before meals',
        duration: '15 days',
        instructions: 'Mix with organic honey',
      },
    ];

    it('DEFENSE: rejects unauthorized patient attempting to create prescription', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${patient1Token}`)
        .send({
          consultationId,
          diagnosis: 'Self diagnosis',
          medications: validMedications,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DEFENSE: rejects doctor not assigned to this consultation', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctor2Token}`) // Doctor 2, but consultation is with Doctor 1!
        .send({
          consultationId,
          diagnosis: 'Interloper diagnosis',
          medications: validMedications,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Only the assigned doctor');
    });

    it('DEFENSE: rejects invalid medication schema (empty medication list)', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultationId,
          diagnosis: 'Valid diagnosis',
          medications: [], // Empty!
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('DEFENSE: rejects medication item missing required dosage or duration', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultationId,
          diagnosis: 'Valid diagnosis',
          medications: [
            {
              name: 'Ashwagandha',
              // dosage is missing!
              frequency: 'Daily',
              duration: '10 days',
            },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('allows assigned doctor to create a valid draft prescription', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultationId,
          diagnosis: 'Amlapitta (Hyperacidity) due to Pitta aggravation',
          medications: validMedications,
          advice: 'Avoid sour, spicy, and deep-fried food. Eat meals at regular intervals.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.prescription.isFinalized).toBe(false);
      expect(res.body.data.prescription.medications).toHaveLength(2);

      prescriptionId = res.body.data.prescription.id;
    });

    it('allows the patient to view their prescription', async () => {
      const res = await request(app)
        .get(`/api/v1/prescriptions/${prescriptionId}`)
        .set('Authorization', `Bearer ${patient1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.prescription.id).toBe(prescriptionId);
      expect(res.body.data.prescription.diagnosis).toContain('Amlapitta');
    });

    it('DEFENSE: forbids unrelated patient from viewing another patient prescription', async () => {
      const res = await request(app)
        .get(`/api/v1/prescriptions/${prescriptionId}`)
        .set('Authorization', `Bearer ${patient2Token}`); // Unrelated patient

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows assigned doctor to update draft prescription before finalization', async () => {
      const updatedMedications = [
        ...validMedications,
        {
          name: 'Shatavari Ghruta',
          dosage: '1 teaspoon',
          frequency: 'Morning empty stomach',
          duration: '30 days',
          instructions: 'Take with warm milk',
        },
      ];

      const res = await request(app)
        .patch(`/api/v1/prescriptions/${prescriptionId}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          diagnosis: 'Updated: Chronic Amlapitta with Mandagni',
          medications: updatedMedications,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.prescription.diagnosis).toContain('Mandagni');
      expect(res.body.data.prescription.medications).toHaveLength(3);
    });

    it('allows assigned doctor to finalize prescription and mark consultation COMPLETED', async () => {
      const res = await request(app)
        .post(`/api/v1/prescriptions/${prescriptionId}/finalize`)
        .set('Authorization', `Bearer ${doctor1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.prescription.isFinalized).toBe(true);

      // Verify consultation status transitioned to COMPLETED
      const consultationInDb = await prisma.consultation.findUnique({
        where: { id: consultationId },
      });
      expect(consultationInDb?.status).toBe('COMPLETED');
    });

    it('DEFENSE: rejects attempts to edit a prescription after finalization (immutability)', async () => {
      const res = await request(app)
        .patch(`/api/v1/prescriptions/${prescriptionId}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          diagnosis: 'Tampered diagnosis after finalization!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('immutable');
    });

    it('DEFENSE: rejects duplicate finalization requests on already finalized prescription', async () => {
      const res = await request(app)
        .post(`/api/v1/prescriptions/${prescriptionId}/finalize`)
        .set('Authorization', `Bearer ${doctor1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already been finalized');
    });
  });

  // ==========================================
  // 2. PAYMENT WEBHOOKS & STATE MACHINE
  // ==========================================
  describe('2. Payment Processing & Webhook State Machine', () => {
    it('DEFENSE: rejects webhook request with missing signature', async () => {
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          eventId: 'evt_no_sig',
          eventType: 'payment.succeeded',
          timestamp: new Date().toISOString(),
          data: {
            paymentReference,
            amount: 600,
            currency: 'INR',
          },
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('signature');
    });

    it('DEFENSE: rejects webhook request with forged / invalid signature', async () => {
      const { payload } = SimulatedPaymentGateway.createSimulatedEvent(
        'payment.succeeded',
        paymentReference,
        600.0
      );

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Amrutam-Signature', 'bad_forged_hex_signature_1234567890abcdef')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid webhook signature');
    });

    it('processes valid signed payment.succeeded webhook and transitions to COMPLETED', async () => {
      const { payload, signature } = SimulatedPaymentGateway.createSimulatedEvent(
        'payment.succeeded',
        paymentReference,
        600.0
      );

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Amrutam-Signature', signature)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.duplicate).toBe(false);
      expect(res.body.data.payment.status).toBe('COMPLETED');

      // Verify in DB
      const paymentInDb = await prisma.payment.findUnique({
        where: { paymentReference },
      });
      expect(paymentInDb?.status).toBe('COMPLETED');
    });

    it('DEDUPLICATION: duplicate webhook event with SAME eventId returns 200 without duplicate write', async () => {
      const eventId = `fixed_dedup_event_${Date.now()}`;
      const { payload, signature } = SimulatedPaymentGateway.createSimulatedEvent(
        'payment.succeeded',
        paymentReference,
        600.0,
        'INR',
        { eventId }
      );

      // First delivery
      const res1 = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Amrutam-Signature', signature)
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.data.duplicate).toBe(false);

      // Second delivery (simulating provider retry)
      const res2 = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Amrutam-Signature', signature)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.data.duplicate).toBe(true);
      expect(res2.body.data.message).toContain('already processed');

      // Verify only 1 webhook event row exists in PostgreSQL
      const eventCount = await prisma.webhookEvent.count({
        where: { eventId },
      });
      expect(eventCount).toBe(1);
    });

    it('processes payment.refunded webhook for COMPLETED payment, transitioning to REFUNDED', async () => {
      const { payload, signature } = SimulatedPaymentGateway.createSimulatedEvent(
        'payment.refunded',
        paymentReference,
        600.0,
        'INR',
        { refundReason: 'Patient consultation cancellation refund' }
      );

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Amrutam-Signature', signature)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.payment.status).toBe('REFUNDED');

      // Verify DB state
      const paymentInDb = await prisma.payment.findUnique({
        where: { paymentReference },
      });
      expect(paymentInDb?.status).toBe('REFUNDED');
    });

    it('DEFENSE: rejects invalid state transition (cannot transition REFUNDED -> COMPLETED)', async () => {
      const { payload, signature } = SimulatedPaymentGateway.createSimulatedEvent(
        'payment.succeeded',
        paymentReference,
        600.0
      );

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Amrutam-Signature', signature)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Invalid payment state transition');
    });

    it('allows patient to view payment details and verifies no sensitive secrets leak', async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${patient1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.payment.id).toBe(paymentId);
      expect(res.body.data.payment.amount).toBe(600);
      expect(res.body.data.payment.currency).toBe('INR');

      // Verify no sensitive keys or tokens leaked
      expect(res.body.data.payment).not.toHaveProperty('rawResponse');
      expect(res.body.data.payment).not.toHaveProperty('secret');
      expect(res.body.data.payment).not.toHaveProperty('webhookSecret');
    });

    it('DEFENSE: forbids unrelated patient from viewing another patient payment', async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${patient2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
