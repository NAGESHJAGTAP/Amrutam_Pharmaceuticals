import { Router } from 'express';
import { profileController } from './profile.controller.js';
import { authenticate, requireOwnershipOrAdmin } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { getProfileSchema, updateProfileSchema } from './profile.schema.js';

const router = Router();

router.get(
  '/:userId',
  authenticate,
  validate(getProfileSchema),
  requireOwnershipOrAdmin((req) => req.params.userId as string),
  profileController.getProfile
);

router.patch(
  '/:userId',
  authenticate,
  validate(updateProfileSchema),
  requireOwnershipOrAdmin((req) => req.params.userId as string),
  profileController.updateProfile
);

export const profileRoutes = router;
