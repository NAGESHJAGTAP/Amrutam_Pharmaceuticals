import { Request, Response, NextFunction } from 'express';
import { availabilityService } from './availability.service.js';

export class AvailabilityController {
  public createSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await availabilityService.createSlot(
        req.body,
        req.user!.sub,
        req.user!.role
      );
      res.status(201).json({
        success: true,
        message: 'Availability slot created successfully',
        data: { slot: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public getSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await availabilityService.getDoctorSlots(req.query as any);
      res.status(200).json({
        success: true,
        data: { slots: result },
      });
    } catch (error) {
      next(error);
    }
  };

  public cancelSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slotId = req.params.slotId as string;
      const result = await availabilityService.cancelSlot(
        slotId,
        req.user!.sub,
        req.user!.role
      );
      res.status(200).json({
        success: true,
        message: 'Availability slot cancelled successfully',
        data: { slot: result },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const availabilityController = new AvailabilityController();
