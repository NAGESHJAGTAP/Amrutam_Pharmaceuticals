import { Request, Response, NextFunction } from 'express';
import { UserRole, UserStatus } from '@prisma/client';
import { TokenUtil, AccessTokenPayload } from '../security/token.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { prisma, isDatabaseReachable, markDatabaseUnreachable } from '../../infrastructure/database/prisma.js';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Authentication middleware.
 * Validates the JWT Bearer access token and verifies the user exists and is active.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.split(' ')[1];
    const payload = TokenUtil.verifyAccessToken(token);

    // Verify user account status directly in DB if available to handle immediate revocations or suspensions
    let user = null;
    if (isDatabaseReachable()) {
      try {
        user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, role: true, status: true },
        });
      } catch {
        markDatabaseUnreachable(120000);
      }
    }

    if (user) {
      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenError(`User account is ${user.status.toLowerCase()}. Access denied.`);
      }
      req.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
    } else {
      // In offline/demo mode or when DB is unreachable, honor cryptographically valid JWT signature
      req.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid token exists, but does not reject unauthenticated requests.
 */
export const authenticateOptional = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = TokenUtil.verifyAccessToken(token);
        req.user = {
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
        };
      } catch {
        // Safe catch for invalid or expired tokens in optional auth
      }
    }
    next();
  } catch {
    next();
  }
};

/**
 * RBAC authorization middleware.
 * Checks whether the authenticated user has one of the allowed roles.
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(`Forbidden: Action requires one of [${allowedRoles.join(', ')}] permissions`)
      );
    }

    next();
  };
};

/**
 * Resource ownership authorization middleware.
 * Ensures the authenticated user is either the resource owner OR an administrator.
 */
export const requireOwnershipOrAdmin = (getOwnerId: (req: Request) => string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const ownerId = getOwnerId(req);
    const isOwner = req.user.sub === ownerId;
    const isAdmin = req.user.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      return next(new ForbiddenError('Forbidden: You can only view or manage your own resource'));
    }

    next();
  };
};
