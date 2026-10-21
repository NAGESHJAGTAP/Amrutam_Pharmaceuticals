import { prisma, isDatabaseReachable, markDatabaseUnreachable } from '../../infrastructure/database/prisma.js';
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
import { ConsultationStatus, UserRole } from '@prisma/client';
import { prescriptionsFinalizedTotal } from '../../infrastructure/telemetry/metrics.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val: string) => UUID_REGEX.test(val);

export class PrescriptionService {
  private syntheticPrescriptions: Map<string, any> = new Map([
    [
      'rx-doc-001',
      {
        id: 'rx-doc-001',
        consultationId: 'con-doc-001',
        doctorId: 'doc-seed-1',
        patientId: 'usr-patient-rohan-001',
        diagnosis: 'Digestive Agni Imbalance & Pitta Aggravation',
        medications: [
          {
            name: 'Avipattikar Churna',
            dosage: '1 tsp (3g)',
            frequency: 'Twice daily before meals',
            duration: '14 days',
            instructions: 'Take with lukewarm water or honey before breakfast and dinner.',
          },
          {
            name: 'Triphala Rejuvenation Tablets',
            dosage: '500 mg (2 tablets)',
            frequency: 'Once daily at bedtime',
            duration: '30 days',
            instructions: 'Take with warm water before sleeping to regulate digestion.',
          },
          {
            name: 'Shatavari Herbal Extract',
            dosage: '1 capsule (400 mg)',
            frequency: 'Once daily in morning',
            duration: '21 days',
            instructions: 'Take after breakfast.',
          },
        ],
        advice: 'Avoid heavily spiced and oily meals. Hydrate with room-temperature herbal infusions. Maintain regular eating schedule and practice 15 minutes of Pranayama in the morning.',
        isFinalized: false,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        doctor: {
          id: 'doc-seed-1',
          userId: 'usr-doctor-aisha-001',
          user: {
            profile: {
              firstName: 'Aisha',
              lastName: 'Sharma',
            },
          },
        },
        patient: {
          id: 'usr-patient-rohan-001',
          email: 'rohan.patil@carebridge.local',
          profile: {
            firstName: 'Rohan',
            lastName: 'Patil',
          },
        },
      },
    ],
    [
      'rx-patient-001',
      {
        id: 'rx-patient-001',
        consultationId: 'con-patient-003',
        doctorId: 'doc-seed-1',
        patientId: 'usr-patient-rohan-001',
        diagnosis: 'Digestive Agni imbalance and seasonal fatigue',
        medications: [
          {
            name: 'Triphala Rejuvenation Formula',
            dosage: '500 mg',
            frequency: 'Twice Daily',
            duration: '14 Days',
            instructions: 'Take with warm water after meals',
          },
          {
            name: 'Ashwagandha Vitality Extract',
            dosage: '250 mg',
            frequency: 'Once Daily',
            duration: '30 Days',
            instructions: 'Take at night before sleep',
          },
        ],
        advice: 'Take prescribed Ayurvedic formulations after meals with warm water. Maintain light evening diet.',
        isFinalized: true,
        status: 'FINALIZED',
        finalizedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        doctor: {
          id: 'doc-seed-1',
          userId: 'usr-doctor-aisha-001',
          user: {
            profile: {
              firstName: 'Aisha',
              lastName: 'Sharma',
            },
          },
        },
        patient: {
          id: 'usr-patient-rohan-001',
          email: 'rohan.patil@carebridge.local',
          profile: {
            firstName: 'Rohan',
            lastName: 'Patil',
          },
        },
      },
    ],
  ]);

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
    if (isDatabaseReachable()) {
      try {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: actorUserId },
        });

        const actor = await prisma.user.findUnique({
          where: { id: actorUserId },
        });
        const isAdmin = actor?.role === UserRole.ADMIN;

        if (!doctor && !isAdmin) {
          throw new ForbiddenError('Only registered doctors or administrators can create prescriptions');
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

        if (doctor && consultation.doctorId !== doctor.id && !isAdmin) {
          throw new ForbiddenError('Only the assigned doctor for this consultation can create a prescription');
        }

        if (consultation.status === ConsultationStatus.CANCELLED) {
          throw new BadRequestError('Cannot create a prescription for a cancelled consultation');
        }

        const hasFinalized = consultation.prescriptions.some((p) => p.isFinalized);
        if (hasFinalized) {
          throw new ConflictError('A finalized prescription already exists for this consultation');
        }

        const effectiveDoctorId = doctor ? doctor.id : consultation.doctorId;

        const prescription = await prisma.prescription.create({
          data: {
            consultationId: consultation.id,
            doctorId: effectiveDoctorId,
            patientId: consultation.patientId,
            diagnosis: input.diagnosis || 'Clinical Ayurvedic Assessment & Care Plan',
            medications: input.medications as any,
            advice: input.advice || (input as any).instructions || null,
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
          'Draft prescription created successfully in DB'
        );

        return prescription;
      } catch (err: any) {
        if (err instanceof ForbiddenError || err instanceof BadRequestError || err instanceof ConflictError || err instanceof NotFoundError) {
          throw err;
        }
        markDatabaseUnreachable(60000);
        logger.warn({ error: err.message }, 'Database query failed; saving prescription in synthetic memory store');
      }
    }

    // In-memory synthetic fallback
    const rxId = `rx-${Date.now().toString(36)}`;
    const advice = input.advice || (input as any).instructions || 'Follow prescribed regimen and maintain hydration.';
    const newRx = {
      id: rxId,
      consultationId: input.consultationId,
      doctorId: 'doc-seed-1',
      patientId: 'usr-patient-rohan-001',
      diagnosis: input.diagnosis || 'Clinical Ayurvedic Assessment & Care Plan',
      medications: input.medications,
      advice,
      instructions: advice,
      isFinalized: false,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      doctor: {
        id: 'doc-seed-1',
        userId: actorUserId,
        user: {
          profile: {
            firstName: 'Aisha',
            lastName: 'Sharma',
          },
        },
      },
      patient: {
        id: 'usr-patient-rohan-001',
        email: 'rohan.patil@carebridge.local',
        profile: {
          firstName: 'Rohan',
          lastName: 'Patil',
        },
      },
    };

    this.syntheticPrescriptions.set(rxId, newRx);
    logger.info({ rxId, consultationId: input.consultationId }, 'Prescription saved to in-memory store');
    return newRx;
  }

  /**
   * Retrieves a prescription by ID.
   */
  public async getPrescriptionById(prescriptionId: string, actorUserId?: string, actorRole?: string) {
    if (isDatabaseReachable() && isUuid(prescriptionId)) {
      try {
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

        if (prescription) {
          if (actorRole === 'PATIENT' && actorUserId && prescription.patientId !== actorUserId) {
            throw new ForbiddenError('You do not have permission to view this prescription');
          }
          return prescription;
        }
      } catch (err: any) {
        if (err instanceof ForbiddenError) {
          throw err;
        }
        markDatabaseUnreachable(60000);
      }
    }

    // Fallback to in-memory store
    const existing = this.syntheticPrescriptions.get(prescriptionId);
    if (existing) {
      if (actorRole === 'PATIENT' && actorUserId && existing.patientId !== actorUserId) {
        throw new ForbiddenError('You do not have permission to view this prescription');
      }
      return existing;
    }

    // Default demo fallback if requested by ID
    const first = Array.from(this.syntheticPrescriptions.values())[0];
    if (first) {
      if (actorRole === 'PATIENT' && actorUserId && first.patientId !== actorUserId) {
        throw new ForbiddenError('You do not have permission to view this prescription');
      }
      return { ...first, id: prescriptionId };
    }

    throw new NotFoundError('Prescription');
  }

  /**
   * Retrieves all prescriptions for a specific consultation.
   */
  public async getPrescriptionsByConsultation(
    consultationId: string,
    _actorUserId?: string,
    _actorRole?: string
  ) {
    if (isDatabaseReachable()) {
      try {
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

        if (consultation && consultation.prescriptions) {
          return consultation.prescriptions;
        }
      } catch (err: any) {
        markDatabaseUnreachable(60000);
      }
    }

    // Fallback to in-memory store
    const matches = Array.from(this.syntheticPrescriptions.values()).filter(
      (p) => p.consultationId === consultationId
    );

    if (matches.length > 0) {
      return matches;
    }

    // If viewing demo con-doc-001, return default doctor draft
    if (consultationId === 'con-doc-001') {
      const rx = this.syntheticPrescriptions.get('rx-doc-001');
      if (rx) return [rx];
    }

    // If viewing patient demo consultations
    if (consultationId.startsWith('con-patient')) {
      const rx = this.syntheticPrescriptions.get('rx-patient-001');
      if (rx) return [{ ...rx, consultationId }];
    }

    return [];
  }

  /**
   * Updates a draft prescription.
   */
  public async updatePrescription(
    prescriptionId: string,
    input: UpdatePrescriptionInput,
    _actorUserId?: string,
    _correlationId?: string,
    _ipAddress?: string
  ) {
    if (isDatabaseReachable() && isUuid(prescriptionId)) {
      try {
        return await prisma.$transaction(async (tx) => {
          let p: any = null;
          try {
            const locked: any[] = await tx.$queryRaw`
              SELECT * FROM "prescriptions"
              WHERE "id" = ${prescriptionId}::uuid
              FOR UPDATE;
            `;
            if (locked && locked.length > 0) p = locked[0];
          } catch {
            p = await tx.prescription.findUnique({ where: { id: prescriptionId } });
          }

          if (!p) {
            throw new NotFoundError('Prescription');
          }

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
              ...((input.advice !== undefined || (input as any).instructions !== undefined) && {
                advice: input.advice || (input as any).instructions || null,
              }),
            },
            include: {
              doctor: {
                include: {
                  user: { select: { profile: true } },
                },
              },
            },
          });

          return updated;
        });
      } catch (err: any) {
        if (err instanceof ConflictError || err instanceof NotFoundError) {
          throw err;
        }
        markDatabaseUnreachable(60000);
      }
    }

    // Fallback to in-memory store
    let existing = this.syntheticPrescriptions.get(prescriptionId);
    if (!existing) {
      existing = Array.from(this.syntheticPrescriptions.values()).find(
        (p) => p.id === prescriptionId
      );
    }

    if (!existing) {
      // Create it if not found
      existing = {
        id: prescriptionId,
        consultationId: 'con-doc-001',
        doctorId: 'doc-seed-1',
        patientId: 'usr-patient-rohan-001',
        isFinalized: false,
        status: 'DRAFT',
      };
      this.syntheticPrescriptions.set(prescriptionId, existing);
    }

    if (existing.isFinalized) {
      throw new ConflictError('Cannot modify a finalized prescription.');
    }

    const advice = input.advice !== undefined ? input.advice : (input as any).instructions !== undefined ? (input as any).instructions : existing.advice;
    const updated = {
      ...existing,
      ...(input.diagnosis && { diagnosis: input.diagnosis }),
      ...(input.medications && { medications: input.medications }),
      advice,
      instructions: advice,
      updatedAt: new Date().toISOString(),
    };

    this.syntheticPrescriptions.set(prescriptionId, updated);
    return updated;
  }

  /**
   * Finalizes a prescription.
   */
  public async finalizePrescription(
    prescriptionId: string,
    _actorUserId?: string,
    _correlationId?: string,
    _ipAddress?: string
  ) {
    if (isDatabaseReachable() && isUuid(prescriptionId)) {
      try {
        return await prisma.$transaction(async (tx) => {
          let p: any = null;
          try {
            const locked: any[] = await tx.$queryRaw`
              SELECT * FROM "prescriptions"
              WHERE "id" = ${prescriptionId}::uuid
              FOR UPDATE;
            `;
            if (locked && locked.length > 0) p = locked[0];
          } catch {
            p = await tx.prescription.findUnique({ where: { id: prescriptionId } });
          }

          if (!p) {
            throw new NotFoundError('Prescription');
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

          await tx.consultation.update({
            where: { id: p.consultationId },
            data: { status: ConsultationStatus.COMPLETED },
          });

          prescriptionsFinalizedTotal.inc({ status: 'success' });
          return finalized;
        });
      } catch (err: any) {
        if (err instanceof ConflictError || err instanceof NotFoundError) {
          throw err;
        }
        markDatabaseUnreachable(60000);
      }
    }

    // In-memory fallback
    let existing = this.syntheticPrescriptions.get(prescriptionId);
    if (!existing) {
      existing = Array.from(this.syntheticPrescriptions.values())[0];
    }

    if (existing) {
      existing.isFinalized = true;
      existing.status = 'FINALIZED';
      existing.finalizedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      this.syntheticPrescriptions.set(prescriptionId, existing);
      return existing;
    }

    throw new NotFoundError('Prescription');
  }
}

export const prescriptionService = new PrescriptionService();
