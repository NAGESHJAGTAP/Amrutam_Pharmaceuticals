import { SlotStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/app-error.js';
import { CreateSlotInput, GetSlotsQuery } from './availability.schema.js';
import { logger } from '../../common/logging/logger.js';

export class AvailabilityService {
  /**
   * Creates a new availability slot for a doctor.
   * Enforces doctor authorization, temporal validation, application overlap checks,
   * and PostgreSQL-level exclusion constraint protection against race conditions.
   */
  public async createSlot(
    input: CreateSlotInput,
    actorUserId: string,
    actorRole: string
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: input.doctorId },
    });

    if (!doctor) throw new NotFoundError('Doctor');

    // Ownership & RBAC verification
    const isOwner = doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You can only create availability slots for your own doctor account');
    }

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);

    // 1. Application-level temporal overlap pre-check
    const overlappingSlot = await prisma.availabilitySlot.findFirst({
      where: {
        doctorId: input.doctorId,
        status: { not: SlotStatus.CANCELLED },
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });

    if (overlappingSlot) {
      throw new ConflictError(
        'Doctor already has an active availability slot overlapping with this time interval'
      );
    }

    // 2. Database Insert protected by PostgreSQL exclusion constraint (no_overlapping_active_slots)
    try {
      const slot = await prisma.availabilitySlot.create({
        data: {
          doctorId: input.doctorId,
          startTime: start,
          endTime: end,
          status: SlotStatus.AVAILABLE,
        },
      });

      return {
        id: slot.id,
        doctorId: slot.doctorId,
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        status: slot.status,
        createdAt: slot.createdAt.toISOString(),
      };
    } catch (error: any) {
      // Catch PostgreSQL 23P01 (exclusion_violation) or 23505 (unique_violation)
      if (
        error.code === 'P2002' ||
        error.code === 'P2010' ||
        error.message?.includes('no_overlapping_active_slots') ||
        error.message?.includes('exclusion')
      ) {
        logger.warn(
          { doctorId: input.doctorId, start, end },
          'PostgreSQL exclusion constraint blocked concurrent overlapping slot creation'
        );
        throw new ConflictError(
          'A concurrent slot creation was detected that overlaps with this time interval'
        );
      }
      throw error;
    }
  }

  /**
   * Retrieves availability slots for a doctor within a date range.
   */
  public async getDoctorSlots(query: GetSlotsQuery) {
    const { doctorId, startDate, endDate } = query;

    const where: any = {
      doctorId,
      status: SlotStatus.AVAILABLE,
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    } else {
      // Default: future slots only
      where.startTime = { gte: new Date() };
    }

    const slots = await prisma.availabilitySlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });

    return slots.map((s) => ({
      id: s.id,
      doctorId: s.doctorId,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      status: s.status,
    }));
  }

  /**
   * Cancels an availability slot.
   */
  public async cancelSlot(slotId: string, actorUserId: string, actorRole: string) {
    const slot = await prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      include: { doctor: true, consultations: true },
    });

    if (!slot) throw new NotFoundError('Availability slot');

    const isOwner = slot.doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You can only cancel your own availability slots');
    }

    if (slot.status === SlotStatus.CANCELLED) {
      throw new BadRequestError('Slot is already cancelled');
    }

    const hasActiveBooking = slot.consultations?.some((c) => c.status === 'SCHEDULED');
    if (slot.status === SlotStatus.RESERVED && hasActiveBooking) {
      throw new ConflictError(
        'Cannot cancel a slot that is currently booked by a patient. The consultation booking must be cancelled first.'
      );
    }

    const updated = await prisma.availabilitySlot.update({
      where: { id: slotId },
      data: { status: SlotStatus.CANCELLED },
    });

    return updated;
  }
}

export const availabilityService = new AvailabilityService();
