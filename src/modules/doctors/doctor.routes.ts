import { Router } from 'express';
import { doctorController } from './doctor.controller.js';
import { availabilityService } from '../availability/availability.service.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { authenticate, authorize } from '../../common/middleware/auth.middleware.js';
import { searchDoctorsSchema, getDoctorByIdSchema, updateDoctorSchema } from './doctor.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/', validate(searchDoctorsSchema), doctorController.searchDoctors);
router.get('/:doctorId/slots', async (req, res, next) => {
  try {
    const slots = await availabilityService.getDoctorSlots({
      doctorId: req.params.doctorId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.status(200).json({
      success: true,
      data: { slots },
    });
  } catch (err) {
    next(err);
  }
});
router.get('/:doctorId', validate(getDoctorByIdSchema), doctorController.getDoctorById);
router.patch(
  '/:doctorId',
  authenticate,
  authorize([UserRole.DOCTOR, UserRole.ADMIN]),
  validate(updateDoctorSchema),
  doctorController.updateDoctor
);

export const doctorRoutes = router;
