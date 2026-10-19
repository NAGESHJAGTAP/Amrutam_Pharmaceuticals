import { Router } from 'express';
import { consultationController } from './consultation.controller.js';
import { authenticate, authorize } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { requireIdempotency } from '../../common/middleware/idempotency.middleware.js';
import {
  bookConsultationSchema,
  cancelConsultationSchema,
  getConsultationByIdSchema,
} from './consultation.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.post(
  '/book',
  authenticate,
  authorize([UserRole.PATIENT, UserRole.ADMIN]),
  requireIdempotency('BOOK_CONSULTATION'),
  validate(bookConsultationSchema),
  consultationController.bookConsultation
);

router.post(
  '/:consultationId/cancel',
  authenticate,
  requireIdempotency('CANCEL_CONSULTATION'),
  validate(cancelConsultationSchema),
  consultationController.cancelConsultation
);

router.get('/my-bookings', authenticate, consultationController.getMyBookings);

router.get(
  '/doctor-schedule',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  consultationController.getDoctorSchedule
);

router.get(
  '/:consultationId',
  authenticate,
  validate(getConsultationByIdSchema),
  consultationController.getConsultationById
);

export const consultationRoutes = router;
