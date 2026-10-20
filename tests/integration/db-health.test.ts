import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/cache/redis.js';

describe('Phase 2 Integration: Database & Redis Readiness', () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  it('GET /readyz returns 200 OK with live PostgreSQL and Redis UP status', async () => {
    const res = await request(app).get('/readyz');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.checks.database.status).toBe('UP');
    expect(typeof res.body.checks.database.latencyMs).toBe('number');
    expect(res.body.checks.redis.status).toBe('UP');
    expect(typeof res.body.checks.redis.latencyMs).toBe('number');
  });

  it('verifies synthetic seeded data exists in database', async () => {
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin.amrutam@synthetic.local' },
    });
    expect(adminUser).not.toBeNull();
    expect(adminUser?.role).toBe('ADMIN');

    const doctorsCount = await prisma.doctor.count();
    expect(doctorsCount).toBeGreaterThanOrEqual(3);

    const patientsCount = await prisma.user.count({
      where: { role: 'PATIENT' },
    });
    expect(patientsCount).toBeGreaterThanOrEqual(2);
  });

  it('verifies database-enforced anti-double-booking constraint on AvailabilitySlot', async () => {
    // 1. Fetch the already reserved consultation slot or create a designated slot for testing
    let existingConsultation = await prisma.consultation.findFirst();
    if (!existingConsultation) {
      const doctor = await prisma.doctor.findFirst();
      const patient = await prisma.user.findFirst({ where: { role: 'PATIENT' } });
      const slot = await prisma.availabilitySlot.create({
        data: {
          doctorId: doctor!.id,
          startTime: new Date(Date.now() + 86400000),
          endTime: new Date(Date.now() + 86400000 + 3600000),
          status: 'RESERVED',
        },
      });
      existingConsultation = await prisma.consultation.create({
        data: {
          consultationNumber: `HEALTH-TEST-${Date.now()}`,
          patientId: patient!.id,
          doctorId: doctor!.id,
          slotId: slot.id,
          status: 'SCHEDULED',
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });
    }
    expect(existingConsultation).not.toBeNull();

    // 2. Fetch another patient
    const otherPatient = await prisma.user.findFirst({
      where: {
        role: 'PATIENT',
        id: { not: existingConsultation!.patientId },
      },
    });
    expect(otherPatient).not.toBeNull();

    // 3. Attempt to create a SECOND consultation for the EXACT same slotId
    // The PostgreSQL unique constraint on slotId MUST reject this!
    let caughtError: any = null;
    try {
      await prisma.consultation.create({
        data: {
          consultationNumber: `DUPLICATE-TEST-${Date.now()}`,
          patientId: otherPatient!.id,
          doctorId: existingConsultation!.doctorId,
          slotId: existingConsultation!.slotId, // Same slot!
          status: 'SCHEDULED',
          startTime: existingConsultation!.startTime,
          endTime: existingConsultation!.endTime,
        },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).not.toBeNull();
    // Prisma maps Postgres 23505 unique constraint violation to code P2002
    expect(caughtError.code).toBe('P2002');
    expect(caughtError.meta.target).toContain('slotId');
  });
});
