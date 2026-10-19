import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/cache/redis.js';

describe('Pre-Phase 4 Analysis: Discrete Slot Uniqueness vs. Interval Overlap Prevention', () => {
  beforeAll(async () => {
    // Clean up any test slots from previous runs of this file
    await prisma.consultation.deleteMany({
      where: { consultationNumber: { startsWith: 'CON-SLOT-TEST-' } },
    });
    await prisma.availabilitySlot.deleteMany({
      where: {
        OR: [
          { startTime: new Date('2026-11-01T14:00:00.000Z') },
          { startTime: new Date('2028-01-01T10:00:00.000Z') },
        ],
      },
    });
  });

  afterAll(async () => {
    await prisma.consultation.deleteMany({
      where: { consultationNumber: { startsWith: 'CON-SLOT-TEST-' } },
    });
    await prisma.availabilitySlot.deleteMany({
      where: {
        OR: [
          { startTime: new Date('2026-11-01T14:00:00.000Z') },
          { startTime: new Date('2028-01-01T10:00:00.000Z') },
        ],
      },
    });
    await prisma.$disconnect();
    await redis.quit();
  });

  /**
   * SCENARIO 1: Duplicate Booking for the EXACT SAME Slot
   * Database Guarantee: Unique Constraint `consultations.slotId`
   */
  it('Scenario 1: Prevents two consultations on the same slotId via PostgreSQL UNIQUE constraint', async () => {
    const doctor = await prisma.doctor.findFirst();
    const patient1 = await prisma.user.findFirst({ where: { role: 'PATIENT' } });
    const patient2 = await prisma.user.findFirst({
      where: { role: 'PATIENT', id: { not: patient1!.id } },
    });

    const testStartTime = new Date('2028-01-01T10:00:00.000Z');
    const slot = await prisma.availabilitySlot.create({
      data: {
        doctorId: doctor!.id,
        startTime: testStartTime,
        endTime: new Date('2028-01-01T10:30:00.000Z'),
        status: 'AVAILABLE',
      },
    });

    // Booking 1 succeeds
    const booking1 = await prisma.consultation.create({
      data: {
        consultationNumber: `CON-SLOT-TEST-${Date.now()}-1`,
        patientId: patient1!.id,
        doctorId: doctor!.id,
        slotId: slot.id,
        status: 'SCHEDULED',
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });
    expect(booking1.id).toBeDefined();

    // Booking 2 attempts to claim the SAME slot
    let error: any = null;
    try {
      await prisma.consultation.create({
        data: {
          consultationNumber: `CON-SLOT-TEST-${Date.now()}-2`,
          patientId: patient2!.id,
          doctorId: doctor!.id,
          slotId: slot.id, // SAME slot
          status: 'SCHEDULED',
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });
    } catch (err) {
      error = err;
    }

    expect(error).not.toBeNull();
    // Prisma maps Postgres 23505 unique constraint violation to P2002
    expect(error.code).toBe('P2002');
    expect(JSON.stringify(error.meta)).toMatch(/slotId|unique_active_consultation_slot/);
  });

  /**
   * SCENARIO 2: Overlapping Time Intervals across Different Slots
   * Issue: Two slots have different IDs, but their time spans overlap!
   * Example:
   * Slot A: 14:00 - 14:30
   * Slot B: 14:15 - 14:45 (Overlaps by 15 mins!)
   */
  it('Scenario 2: Demonstrates identical start time rejection and interval overlap validation logic', async () => {
    const doctor = await prisma.doctor.findFirst();
    const baseTime = new Date('2026-11-01T14:00:00.000Z');

    // Slot A: 14:00 to 14:30
    const slotA = await prisma.availabilitySlot.create({
      data: {
        doctorId: doctor!.id,
        startTime: baseTime,
        endTime: new Date('2026-11-01T14:30:00.000Z'),
        status: 'AVAILABLE',
      },
    });
    expect(slotA.id).toBeDefined();

    // Attempting to create another slot with the EXACT same startTime triggers the @@unique([doctorId, startTime]) constraint
    let duplicateStartError: any = null;
    try {
      await prisma.availabilitySlot.create({
        data: {
          doctorId: doctor!.id,
          startTime: baseTime, // Identical start time!
          endTime: new Date('2026-11-01T14:45:00.000Z'),
          status: 'AVAILABLE',
        },
      });
    } catch (err) {
      duplicateStartError = err;
    }
    expect(duplicateStartError).not.toBeNull();
    expect(duplicateStartError.code).toBe('P2002');

    // Interval Overlap Query Logic:
    // When a doctor creates a custom slot (e.g. 14:15 to 14:45), the application queries:
    // WHERE doctorId = :docId AND status != 'CANCELLED' AND (startTime < newEndTime AND endTime > newStartTime)
    const proposedStart = new Date('2026-11-01T14:15:00.000Z');
    const proposedEnd = new Date('2026-11-01T14:45:00.000Z');

    const overlappingSlots = await prisma.availabilitySlot.findMany({
      where: {
        doctorId: doctor!.id,
        status: { not: 'CANCELLED' },
        startTime: { lt: proposedEnd },
        endTime: { gt: proposedStart },
      },
    });

    // The query accurately identifies that Slot A overlaps with the proposed interval!
    expect(overlappingSlots.length).toBeGreaterThan(0);
    expect(overlappingSlots[0].id).toBe(slotA.id);
  });
});
