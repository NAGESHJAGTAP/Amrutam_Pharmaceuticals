import { prisma } from '../../infrastructure/database/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/app-error.js';
import {
  CreatePrescriptionInput,
  UpdatePrescriptionInput,
} from './prescription.schema.js';
import { logger } from '../../common/logging/logger.js';
import { ConsultationStatus } from '@prisma/client';
import { prescriptionsFinalizedTotal } from '../../infrastructure/telemetry/metrics.js';

export class PrescriptionService {
  /**
   * Creates a draft prescription for a consultation.
   * Only the authorized doctor assigned to the consultation can create its prescription.
   */
  public async createPrescription(
    actorUserId: string,
    input: CreatePrescriptionInput,
    correlationId?: string,
    ipAddress?: string
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: actorUserId },
    });
    if (!doctor) {
      throw new ForbiddenError('Only registered doctors can create prescriptions');
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: input.consultationId },
      include: {
        prescriptions: true,
      },
    });

    if (!consultation) {
      throw new NotFoundError('Consultation');
    }

    // Consultation doctor ownership check
    if (consultation.doctorId !== doctor.id) {
      throw new ForbiddenError('Only the assigned doctor for this consultation can create a prescription');
    }

    // Cannot prescribe for cancelled consultation
    if (consultation.status === ConsultationStatus.CANCELLED) {
      throw new BadRequestError('Cannot create a prescription for a cancelled consultation');
    }

    // Check if a finalized prescription already exists
    const hasFinalized = consultation.prescriptions.some((p) => p.isFinalized);
    if (hasFinalized) {
      throw new ConflictError('A finalized prescription already exists for this consultation');
    }

    const prescription = await prisma.prescription.create({
      data: {
        consultationId: consultation.id,
        doctorId: doctor.id,
        patientId: consultation.patientId,
        diagnosis: input.diagnosis,
        medications: input.medications as any,
        advice: input.advice || null,
        isFinalized: false,
      },
      include: {
        doctor: {
          include: {
            user: { select: { profile: true } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'PRESCRIPTION_CREATED',
        entityType: 'Prescription',
        entityId: prescription.id,
        details: {
          consultationId: consultation.id,
          medicationsCount: input.medications.length,
        },
        ipAddress,
        correlationId,
      },
    });

    logger.info(
      { prescriptionId: prescription.id, consultationId: consultation.id, actorUserId },
      'Draft prescription created successfully'
    );

    return prescription;
  }

  /**
   * Retrieves a prescription by ID.
   * Access is strictly restricted to the patient, assigned doctor, or administrator.
   */
  public async getPrescriptionById(prescriptionId: string, actorUserId: string, actorRole: string) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
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
        consultation: true,
      },
    });

    if (!prescription) {
      throw new NotFoundError('Prescription');
    }

    const isPatient = prescription.patientId === actorUserId;
    const isDoctor = prescription.doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this prescription');
    }

    return prescription;
  }

  /**
   * Retrieves all prescriptions for a specific consultation.
   */
  public async getPrescriptionsByConsultation(
    consultationId: string,
    actorUserId: string,
    actorRole: string
  ) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        doctor: true,
        prescriptions: {
          include: {
            doctor: {
              include: {
                user: { select: { profile: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!consultation) {
      throw new NotFoundError('Consultation');
    }

    const isPatient = consultation.patientId === actorUserId;
    const isDoctor = consultation.doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view prescriptions for this consultation');
    }

    return consultation.prescriptions;
  }

  /**
   * Updates a draft prescription.
   * Protected with PostgreSQL row-level locking (SELECT ... FOR UPDATE) to prevent
   * concurrent edits and guarantee legal immutability once finalized.
   */
  public async updatePrescription(
    prescriptionId: string,
    input: UpdatePrescriptionInput,
    actorUserId: string,
    correlationId?: string,
    ipAddress?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const locked: any[] = await tx.$queryRaw`
        SELECT * FROM "prescriptions"
        WHERE "id" = ${prescriptionId}::uuid
        FOR UPDATE;
      `;

      if (!locked || locked.length === 0) {
        throw new NotFoundError('Prescription');
      }

      const p = locked[0];

      const doctor = await tx.doctor.findUnique({
        where: { userId: actorUserId },
      });
      if (!doctor || p.doctorId !== doctor.id) {
        throw new ForbiddenError('Only the prescribing doctor can update this prescription');
      }

      // Strict immutability check
      if (p.isFinalized) {
        throw new ConflictError(
          'Cannot modify a finalized prescription. Finalized medical prescriptions are immutable.'
        );
      }

      const updated = await tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          ...(input.diagnosis && { diagnosis: input.diagnosis }),
          ...(input.medications && { medications: input.medications as any }),
          ...(input.advice !== undefined && { advice: input.advice || null }),
        },
        include: {
          doctor: {
            include: {
              user: { select: { profile: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'PRESCRIPTION_UPDATED',
          entityType: 'Prescription',
          entityId: prescriptionId,
          details: { updatedFields: Object.keys(input) },
          ipAddress,
          correlationId,
        },
      });

      return updated;
    });
  }

  /**
   * Finalizes a prescription.
   * Uses row-level locking to prevent race conditions during concurrent finalization requests.
   * Transitions consultation status to COMPLETED.
   */
  public async finalizePrescription(
    prescriptionId: string,
    actorUserId: string,
    correlationId?: string,
    ipAddress?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const locked: any[] = await tx.$queryRaw`
        SELECT * FROM "prescriptions"
        WHERE "id" = ${prescriptionId}::uuid
        FOR UPDATE;
      `;

      if (!locked || locked.length === 0) {
        throw new NotFoundError('Prescription');
      }

      const p = locked[0];

      const doctor = await tx.doctor.findUnique({
        where: { userId: actorUserId },
      });
      if (!doctor || p.doctorId !== doctor.id) {
        throw new ForbiddenError('Only the prescribing doctor can finalize this prescription');
      }

      if (p.isFinalized) {
        throw new ConflictError('Prescription has already been finalized');
      }

      const finalized = await tx.prescription.update({
        where: { id: prescriptionId },
        data: { isFinalized: true },
        include: {
          doctor: {
            include: {
              user: { select: { profile: true } },
            },
          },
        },
      });

      // Update consultation status to COMPLETED
      await tx.consultation.update({
        where: { id: p.consultationId },
        data: { status: ConsultationStatus.COMPLETED },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'PRESCRIPTION_FINALIZED',
          entityType: 'Prescription',
          entityId: prescriptionId,
          details: { consultationId: p.consultationId },
          ipAddress,
          correlationId,
        },
      });

      // Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Prescription',
          aggregateId: prescriptionId,
          eventType: 'prescription.finalized',
          payload: {
            prescriptionId,
            consultationId: p.consultationId,
            doctorId: doctor.id,
            patientId: p.patientId,
          },
          status: 'PENDING',
        },
      });

      prescriptionsFinalizedTotal.inc({ status: 'success' });

      logger.info(
        { prescriptionId, consultationId: p.consultationId, actorUserId },
        'Prescription finalized and locked; consultation marked COMPLETED'
      );

      return finalized;
    });
  }
}

export const prescriptionService = new PrescriptionService();
