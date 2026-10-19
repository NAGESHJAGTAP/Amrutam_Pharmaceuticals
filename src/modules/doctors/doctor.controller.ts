import { Request, Response, NextFunction } from 'express';
import { doctorService } from './doctor.service.js';

export class DoctorController {
  public searchDoctors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await doctorService.searchDoctors(req.query as any);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getDoctorById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doctorId = req.params.doctorId as string;
      const result = await doctorService.getDoctorById(doctorId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doctorId = req.params.doctorId as string;
      const actorUserId = req.user!.sub;
      const actorRole = req.user!.role;

      const result = await doctorService.updateDoctorProfile(
        doctorId,
        req.body,
        actorUserId,
        actorRole
      );

      res.status(200).json({
        success: true,
        message: 'Doctor profile updated successfully',
        data: { doctor: result },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const doctorController = new DoctorController();
