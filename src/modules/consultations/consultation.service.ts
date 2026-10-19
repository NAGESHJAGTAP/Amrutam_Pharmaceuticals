import { ConsultationStatus, SlotStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/app-error.js';
import { BookConsultationInput } from './consultation.schema.js';
import crypto from 'node:crypto';
import { logger } from '../../common/logging/logger.js';

export class ConsultationService {
  /**
   * Books a consultation slot using PostgreSQL transactions and row-level locking (SELECT ... FOR UPDATE).
   * Backed by PostgreSQL unique constraint on slotId to eliminate double-booking race conditions.
   */
  public async bookConsultation(
    patientUserId: string,
    input: BookConsultationInput,
    correlationId?: string,
    ipAddress?: string
  ) {
    const { doctorId, slotId, reason } = input;

    // Execute within an interactive PostgreSQL transaction
    return await prisma.$transaction(
      async (tx) => {
        // 1. Acquire exclusive row lock on the availability slot to prevent concurrent double bookings
        const lockedSlots: any[] = await tx.$queryRaw`
          SELECT * FROM "availability_slots"
          WHERE "id" = ${slotId}::uuid
          FOR UPDATE;
        `;

        if (!lockedSlots || lockedSlots.length === 0) {
          throw new NotFoundError('Availability slot');
        }

        const slot = lockedSlots[0];

        // 2. Validate doctor assignment
        if (slot.doctorId !== doctorId) {
          throw new BadRequestError('Specified availability slot does not belong to this doctor');
        }

        // 3. Validate temporal validity (cannot book slots in the past)
        if (new Date(slot.startTime) < new Date()) {
          throw new BadRequestError('Cannot reserve an availability slot in the past');
        }

        // 4. Validate slot availability status
        if (slot.status !== SlotStatus.AVAILABLE) {
          throw new ConflictError(
            'The requested availability slot has already been reserved or cancelled'
          );
        }

        // 5. Fetch doctor details for fee calculation
        const doctor = await tx.doctor.findUnique({
          where: { id: doctorId },
        });
        if (!doctor) throw new NotFoundError('Doctor');

        // 6. Update slot state to RESERVED
        await tx.availabilitySlot.update({
          where: { id: slotId },
          data: { status: SlotStatus.RESERVED },
        });

        // 7. Create Consultation record (protected by @@unique constraint on slotId)
        const timestamp = Date.now();
        const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const consultationNumber = `CON-${timestamp}-${randomSuffix}`;

        let consultation;
        try {
          consultation = await tx.consultation.create({
            data: {
              consultationNumber,
              patientId: patientUserId,
              doctorId,
              slotId,
              status: ConsultationStatus.SCHEDULED,
              reason: reason || null,
              startTime: slot.startTime,
              endTime: slot.endTime,
              payment: {
                create: {
                  paymentReference: `PAY-${timestamp}-${randomSuffix}`,
                  provider: 'MOCK_GATEWAY',
                  amount: doctor.consultationFee,
                  currency: doctor.currency,
                  status: PaymentStatus.PENDING,
                },
              },
            },
            include: {
              doctor: {
                include: {
                  user: {
                    select: {
                      profile: true,
                    },
                  },
                },
              },
              payment: true,
            },
          });
        } catch (error: any) {
          if (error.code === 'P2002') {
            throw new ConflictError('The requested availability slot has already been reserved');
          }
          throw error;
        }

        // 8. Log security and compliance audit event
        await tx.auditLog.create({
          data: {
            actorId: patientUserId,
            action: 'CONSULTATION_BOOKED',
            entityType: 'Consultation',
            entityId: consultation.id,
            details: {
              consultationNumber: consultation.consultationNumber,
              doctorId,
              slotId,
              fee: Number(doctor.consultationFee),
            },
            ipAddress,
            correlationId,
          },
        });

        // 9. Transactional Outbox Event (committed in same transaction)
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Consultation',
            aggregateId: consultation.id,
            eventType: 'consultation.booked',
            payload: {
              consultationId: consultation.id,
              consultationNumber: consultation.consultationNumber,
              patientId: patientUserId,
              doctorId,
              startTime: slot.startTime.toISOString(),
              endTime: slot.endTime.toISOString(),
            },
            status: 'PENDING',
          },
        });

        logger.info(
          {
            consultationId: consultation.id,
            consultationNumber: consultation.consultationNumber,
            patientId: patientUserId,
            doctorId,
            correlationId,
          },
          'Consultation booked successfully under transactional row lock'
        );

        return consultation;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }

  /**
   * Cancels a consultation and safely transitions the slot back to AVAILABLE.
   */
  public async cancelConsultation(
    consultationId: string,
    reason: string | undefined,
    actorUserId: string,
    actorRole: string,
    correlationId?: string,
    ipAddress?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.findUnique({
        where: { id: consultationId },
        include: {
          doctor: true,
          payment: true,
        },
      });

      if (!consultation) throw new NotFoundError('Consultation');

      // Authorization: Patient owner, Doctor assigned, or Admin
      const isPatient = consultation.patientId === actorUserId;
      const isDoctor = consultation.doctor.userId === actorUserId;
      const isAdmin = actorRole === 'ADMIN';

      if (!isPatient && !isDoctor && !isAdmin) {
        throw new ForbiddenError('You do not have permission to cancel this consultation');
      }

      // State Machine Validation
      if (consultation.status === ConsultationStatus.CANCELLED) {
        throw new BadRequestError('Consultation is already cancelled');
      }

      if (consultation.status === ConsultationStatus.COMPLETED) {
        throw new BadRequestError('Cannot cancel a completed consultation');
      }

      // 1. Update Consultation status
      const updatedConsultation = await tx.consultation.update({
        where: { id: consultationId },
        data: {
          status: ConsultationStatus.CANCELLED,
          notes: reason ? `Cancelled with reason: ${reason}` : 'Cancelled by user',
        },
      });

      // 2. Transition availability slot back to AVAILABLE so doctor schedule remains consistent
      await tx.availabilitySlot.update({
        where: { id: consultation.slotId },
        data: { status: SlotStatus.AVAILABLE },
      });

      // 3. If payment was completed, set to REFUNDED
      if (consultation.payment && consultation.payment.status === PaymentStatus.COMPLETED) {
        await tx.payment.update({
          where: { id: consultation.payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      }

      // 4. Log Audit Event
      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'CONSULTATION_CANCELLED',
          entityType: 'Consultation',
          entityId: consultation.id,
          details: { reason, cancelledByRole: actorRole },
          ipAddress,
          correlationId,
        },
      });

      // 5. Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Consultation',
          aggregateId: consultation.id,
          eventType: 'consultation.cancelled',
          payload: {
            consultationId: consultation.id,
            consultationNumber: consultation.consultationNumber,
            patientId: consultation.patientId,
            doctorId: consultation.doctorId,
            reason,
            cancelledByRole: actorRole,
          },
          status: 'PENDING',
        },
      });

      return updatedConsultation;
    });
  }

  /**
   * Retrieves all consultations for an authenticated patient.
   */
  public async getPatientConsultations(patientUserId: string) {
    const consultations = await prisma.consultation.findMany({
      where: { patientId: patientUserId },
      orderBy: { startTime: 'desc' },
      include: {
        doctor: {
          include: {
            user: { select: { profile: true } },
          },
        },
        payment: true,
      },
    });

    return consultations;
  }

  /**
   * Retrieves all consultations for an authenticated doctor.
   */
  public async getDoctorSchedule(doctorUserId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: doctorUserId },
    });
    if (!doctor) throw new NotFoundError('Doctor profile');

    const consultations = await prisma.consultation.findMany({
      where: { doctorId: doctor.id },
      orderBy: { startTime: 'asc' },
      include: {
        patient: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        payment: true,
      },
    });

    return consultations;
  }

  /**
   * Retrieves a single consultation by ID with authorization check.
   */
  public async getConsultationById(
    consultationId: string,
    actorUserId: string,
    actorRole: string
  ) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        doctor: {
          include: {
            user: { select: { profile: true } },
          },
        },
        patient: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        payment: true,
        prescriptions: true,
      },
    });

    if (!consultation) throw new NotFoundError('Consultation');

    const isPatient = consultation.patientId === actorUserId;
    const isDoctor = consultation.doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new ForbiddenError('You do not have access to view this consultation record');
    }

    return consultation;
  }
}

export const consultationService = new ConsultationService();
