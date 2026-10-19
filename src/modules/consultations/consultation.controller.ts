import { Request, Response, NextFunction } from 'express';
import { consultationService } from './consultation.service.js';

export class ConsultationController {
  public bookConsultation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientUserId = req.user!.sub;
      const result = await consultationService.bookConsultation(
        patientUserId,
        req.body,
        req.correlationId,
        req.ip
      );
      res.status(201).json({
        success: true,
        message: 'Consultation booked successfully',
        data: { consultation: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public cancelConsultation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const { reason } = req.body;
      const result = await consultationService.cancelConsultation(
        consultationId,
        reason,
        req.user!.sub,
        req.user!.role,
        req.correlationId,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Consultation cancelled successfully',
        data: { consultation: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public getMyBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientUserId = req.user!.sub;
      const result = await consultationService.getPatientConsultations(patientUserId);
      res.status(200).json({
        success: true,
        data: { consultations: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public getDoctorSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doctorUserId = req.user!.sub;
      const result = await consultationService.getDoctorSchedule(doctorUserId);
      res.status(200).json({
        success: true,
        data: { consultations: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public getConsultationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const result = await consultationService.getConsultationById(
        consultationId,
        req.user!.sub,
        req.user!.role
      );
      res.status(200).json({
        success: true,
        data: { consultation: result },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const consultationController = new ConsultationController();
