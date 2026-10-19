import { Router } from 'express';
import { doctorController } from './doctor.controller.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { authenticate, authorize } from '../../common/middleware/auth.middleware.js';
import { searchDoctorsSchema, getDoctorByIdSchema, updateDoctorSchema } from './doctor.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/', validate(searchDoctorsSchema), doctorController.searchDoctors);
router.get('/:doctorId', validate(getDoctorByIdSchema), doctorController.getDoctorById);
router.patch(
  '/:doctorId',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  validate(updateDoctorSchema),
  doctorController.updateDoctor
);

export const doctorRoutes = router;
