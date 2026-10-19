import { Router } from 'express';
import { availabilityController } from './availability.controller.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { authenticate, authorize } from '../../common/middleware/auth.middleware.js';
import { createSlotSchema, getSlotsSchema, cancelSlotSchema } from './availability.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.post(
  '/slots',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  validate(createSlotSchema),
  availabilityController.createSlot
);

router.get(
  '/slots',
  validate(getSlotsSchema),
  availabilityController.getSlots
);

router.delete(
  '/slots/:slotId',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  validate(cancelSlotSchema),
  availabilityController.cancelSlot
);

export const availabilityRoutes = router;
