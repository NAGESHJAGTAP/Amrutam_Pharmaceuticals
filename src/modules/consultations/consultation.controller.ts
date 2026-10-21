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
        data: result,
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
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAllConsultations = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await consultationService.getAllPlatformConsultations();
      res.status(200).json({
        success: true,
        data: result,
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

  public initiateCall = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const result = await consultationService.initiateCall(
        consultationId,
        req.user?.sub || 'usr-doctor-aisha-001',
        req.user?.role || 'DOCTOR'
      );
      res.status(200).json({
        success: true,
        data: { activeCall: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public getActiveCall = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const activeCall = await consultationService.getActiveCall(
        req.user?.sub || 'usr-patient-rohan-001',
        req.user?.role || 'PATIENT',
        req.user?.email || 'rohan.patil@synthetic.local'
      );
      res.status(200).json({
        success: true,
        data: { activeCall },
      });
    } catch (error) {
      next(error);
    }
  };

  public respondToCall = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const { action } = req.body;
      const result = await consultationService.respondToCall(
        consultationId,
        action,
        req.user?.sub || 'usr-patient-rohan-001'
      );
      res.status(200).json({
        success: true,
        data: { call: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public sendSignal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const { type, payload } = req.body;
      const signal = await consultationService.addSignal(
        consultationId,
        req.user?.sub || 'anonymous-user',
        req.user?.role || 'PATIENT',
        type,
        payload
      );
      res.status(200).json({
        success: true,
        data: { signal },
      });
    } catch (error) {
      next(error);
    }
  };

  public getSignals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const since = Number(req.query.since || 0);
      const signals = await consultationService.getSignals(
        consultationId,
        since,
        req.user?.sub || 'anonymous-user'
      );
      res.status(200).json({
        success: true,
        data: { signals },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const consultationController = new ConsultationController();
