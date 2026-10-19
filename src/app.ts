import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { httpLoggerMiddleware } from './common/middleware/http-logger.middleware.js';
import { errorHandlerMiddleware } from './common/middleware/error-handler.middleware.js';
import { NotFoundError } from './common/errors/app-error.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { profileRoutes } from './modules/profiles/profile.routes.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import { availabilityRoutes } from './modules/availability/availability.routes.js';
import { consultationRoutes } from './modules/consultations/consultation.routes.js';

export const createApp = (): Express => {
  const app = express();

  // Security Headers
  app.use(helmet());

  // CORS Policy
  app.use(
    cors({
      origin: env.CORS_ORIGIN.includes(',') ? env.CORS_ORIGIN.split(',') : env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID', 'Idempotency-Key'],
      credentials: true,
    })
  );

  // Request Body Size Limit (prevents large payload DoS)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request Tracing and Structured Logging
  app.use(correlationIdMiddleware);
  app.use(httpLoggerMiddleware);

  // Base API routes
  app.use('/', healthRoutes);
  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profiles', profileRoutes);
  app.use('/api/v1/doctors', doctorRoutes);
  app.use('/api/v1/availability', availabilityRoutes);
  app.use('/api/v1/consultations', consultationRoutes);

  // 404 Catch-All Handler
  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handler
  app.use(errorHandlerMiddleware);

  return app;
};
