import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { NotFoundError } from '../../common/errors/app-error.js';

export class AuthController {
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.registerPatient(
        req.body,
        req.correlationId,
        req.ip,
        req.get('user-agent')
      );
      res.status(201).json({
        success: true,
        message: 'Patient registered successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(
        req.body,
        req.correlationId,
        req.ip,
        req.get('user-agent')
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyMfaLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.verifyMfaLogin(
        req.body,
        req.correlationId,
        req.ip,
        req.get('user-agent')
      );
      res.status(200).json({
        success: true,
        message: 'MFA verification successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.rotateRefreshToken(
        refreshToken,
        req.correlationId,
        req.ip,
        req.get('user-agent')
      );
      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: { tokens },
      });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken, req.correlationId, req.ip);
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public setupMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const result = await authService.initiateMfaSetup(userId);
      res.status(200).json({
        success: true,
        message: 'MFA setup initiated. Scan the QR code URI into your authenticator app and verify.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyMfaSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const { code } = req.body;
      const result = await authService.verifyAndEnableMfa(userId, code, req.correlationId, req.ip);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const result = await authService.changePassword(userId, req.body, req.correlationId, req.ip);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          mfaEnabled: true,
          createdAt: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              emergencyContact: true,
            },
          },
          doctor: {
            select: {
              id: true,
              licenseNumber: true,
              specialty: true,
              experienceYears: true,
              consultationFee: true,
              currency: true,
              verificationStatus: true,
            },
          },
        },
      });

      if (!user) throw new NotFoundError('User');

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
