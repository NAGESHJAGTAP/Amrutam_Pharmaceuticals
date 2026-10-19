import { Request, Response, NextFunction } from 'express';
import { profileService } from './profile.service.js';

export class ProfileController {
  public getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const result = await profileService.getProfileByUserId(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const result = await profileService.updateProfile(
        userId,
        req.body,
        req.correlationId,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { profile: result },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const profileController = new ProfileController();
