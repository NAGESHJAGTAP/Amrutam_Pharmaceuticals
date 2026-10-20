import { Router } from 'express';
import { consultationController } from './consultation.controller.js';
import { authenticate, authorize } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { requireIdempotency } from '../../common/middleware/idempotency.middleware.js';
import { bookingRateLimiter } from '../../common/middleware/rate-limit.middleware.js';
import {
  bookConsultationSchema,
  cancelConsultationSchema,
  getConsultationByIdSchema,
  listMyBookingsSchema,
  getDoctorScheduleSchema,
} from './consultation.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.post(
  '/book',
  authenticate,
  authorize([UserRole.PATIENT, UserRole.ADMIN]),
  bookingRateLimiter,
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

router.get('/my-bookings', authenticate, validate(listMyBookingsSchema), consultationController.getMyBookings);

router.get(
  '/doctor-schedule',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  validate(getDoctorScheduleSchema),
  consultationController.getDoctorSchedule
);

router.get(
  '/:consultationId',
  authenticate,
  validate(getConsultationByIdSchema),
  consultationController.getConsultationById
);

export const consultationRoutes = router;
