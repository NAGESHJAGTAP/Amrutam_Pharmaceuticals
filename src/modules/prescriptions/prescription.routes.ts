import { Router } from 'express';
import { prescriptionController } from './prescription.controller.js';
import { authenticate, authorize } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { idempotent } from '../../common/middleware/idempotency.middleware.js';
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  finalizePrescriptionSchema,
  getPrescriptionByIdSchema,
  getPrescriptionsByConsultationSchema,
} from './prescription.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Doctor / Admin creates a draft prescription
router.post(
  '/',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  validate(createPrescriptionSchema),
  prescriptionController.createPrescription
);

// Retrieve single prescription (Patient, Doctor, Admin)
router.get(
  '/:prescriptionId',
  authenticate,
  validate(getPrescriptionByIdSchema),
  prescriptionController.getPrescriptionById
);

// Retrieve prescriptions for consultation (Patient, Doctor, Admin)
router.get(
  '/consultation/:consultationId',
  authenticate,
  validate(getPrescriptionsByConsultationSchema),
  prescriptionController.getPrescriptionsByConsultation
);

// Doctor / Admin updates a draft prescription (rejected if finalized)
router.patch(
  '/:prescriptionId',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  validate(updatePrescriptionSchema),
  prescriptionController.updatePrescription
);

// Doctor / Admin finalizes prescription (locked against future edits, supports Idempotency-Key)
router.post(
  '/:prescriptionId/finalize',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  idempotent('PRESCRIPTION_FINALIZE', { required: false }),
  validate(finalizePrescriptionSchema),
  prescriptionController.finalizePrescription
);

export const prescriptionRoutes = router;
