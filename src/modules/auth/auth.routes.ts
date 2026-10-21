import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import {
  authRateLimiter,
  refreshRateLimiter,
  mfaRateLimiter,
  passwordChangeLimiter,
} from '../../common/middleware/rate-limit.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  mfaVerifyLoginSchema,
  mfaVerifySetupSchema,
  changePasswordSchema,
} from './auth.schema.js';

const router = Router();

// Public Authentication Endpoints (protected by authRateLimiter & refreshRateLimiter)
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/mfa/verify-login', authRateLimiter, validate(mfaVerifyLoginSchema), authController.verifyMfaLogin);
router.post('/refresh', refreshRateLimiter, validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', validate(logoutSchema), authController.logout);

// Protected Authentication & Session Endpoints
router.get('/me', authenticate, authController.getMe);
router.post('/mfa/setup', authenticate, mfaRateLimiter, authController.setupMfa);
router.post('/mfa/verify-setup', authenticate, mfaRateLimiter, validate(mfaVerifySetupSchema), authController.verifyMfaSetup);
router.post('/change-password', authenticate, passwordChangeLimiter, validate(changePasswordSchema), authController.changePassword);

export const authRoutes = router;
