import { Request, Response, NextFunction } from 'express';
import { prescriptionService } from './prescription.service.js';

export class PrescriptionController {
  public createPrescription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actorUserId = req.user!.sub;
      const correlationId = req.correlationId;
      const ipAddress = req.ip;

      const result = await prescriptionService.createPrescription(
        actorUserId,
        req.body,
        correlationId,
        ipAddress
      );

      res.status(201).json({
        success: true,
        message: 'Prescription created successfully as draft',
        data: { prescription: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPrescriptionById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const prescriptionId = req.params.prescriptionId as string;
      const actorUserId = req.user!.sub;
      const actorRole = req.user!.role;

      const result = await prescriptionService.getPrescriptionById(
        prescriptionId,
        actorUserId,
        actorRole
      );

      res.status(200).json({
        success: true,
        data: { prescription: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPrescriptionsByConsultation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const actorUserId = req.user!.sub;
      const actorRole = req.user!.role;

      const result = await prescriptionService.getPrescriptionsByConsultation(
        consultationId,
        actorUserId,
        actorRole
      );

      res.status(200).json({
        success: true,
        data: { prescriptions: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public updatePrescription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const prescriptionId = req.params.prescriptionId as string;
      const actorUserId = req.user!.sub;
      const correlationId = req.correlationId;
      const ipAddress = req.ip;

      const result = await prescriptionService.updatePrescription(
        prescriptionId,
        req.body,
        actorUserId,
        correlationId,
        ipAddress
      );

      res.status(200).json({
        success: true,
        message: 'Prescription updated successfully',
        data: { prescription: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public finalizePrescription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const prescriptionId = req.params.prescriptionId as string;
      const actorUserId = req.user!.sub;
      const correlationId = req.correlationId;
      const ipAddress = req.ip;

      const result = await prescriptionService.finalizePrescription(
        prescriptionId,
        actorUserId,
        correlationId,
        ipAddress
      );

      res.status(200).json({
        success: true,
        message: 'Prescription finalized successfully and locked against edits',
        data: { prescription: result },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const prescriptionController = new PrescriptionController();
