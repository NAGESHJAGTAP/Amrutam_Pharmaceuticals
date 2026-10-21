import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { httpLoggerMiddleware } from './common/middleware/http-logger.middleware.js';
import { errorHandlerMiddleware } from './common/middleware/error-handler.middleware.js';
import { prototypePollutionDefense, enforceContentType } from './common/middleware/security.middleware.js';
import { generalRateLimiter } from './common/middleware/rate-limit.middleware.js';
import { metricsMiddleware } from './common/middleware/metrics.middleware.js';
import { NotFoundError } from './common/errors/app-error.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { profileRoutes } from './modules/profiles/profile.routes.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import { availabilityRoutes } from './modules/availability/availability.routes.js';
import { consultationRoutes } from './modules/consultations/consultation.routes.js';
import { prescriptionRoutes } from './modules/prescriptions/prescription.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';

export const createApp = (): Express => {
  const app = express();

  // Reverse Proxy Trust Configuration
  // Prevents spoofing of X-Forwarded-For headers while allowing legitimate proxy architectures
  if (env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  } else if (env.TRUST_PROXY === 'false') {
    app.set('trust proxy', false);
  } else {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  // Enhanced Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })
  );

  // CORS Policy with Whitelisting (reflects origin when '*' so credentials: true works across domains)
  const corsOriginOption =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: corsOriginOption,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Correlation-ID',
        'X-Request-ID',
        'Idempotency-Key',
        'X-Amrutam-Signature',
        'X-Webhook-Signature',
        'X-Test-Client-Id',
      ],
      credentials: true,
    })
  );

  // Request Body Size Limit (restricted to 100kb to mitigate payload-flooding DoS)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Defensive Input & Security Middleware
  app.use(prototypePollutionDefense);
  app.use(enforceContentType);

  // Request Tracing and Structured Logging
  app.use(correlationIdMiddleware);
  app.use(httpLoggerMiddleware);
  app.use(metricsMiddleware);

  // Health, Readiness and Metrics Endpoints (unthrottled for orchestrator probes and Prometheus scrapers)
  app.use('/', healthRoutes);

  // Global Distributed Rate Limiter for /api/v1 API Routes
  app.use('/api/v1', generalRateLimiter);

  // Base API routes
  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profiles', profileRoutes);
  app.use('/api/v1/doctors', doctorRoutes);
  app.use('/api/v1/availability', availabilityRoutes);
  app.use('/api/v1/consultations', consultationRoutes);
  app.use('/api/v1/prescriptions', prescriptionRoutes);
  app.use('/api/v1/payments', paymentRoutes);

  // 404 Catch-All Handler
  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handler
  app.use(errorHandlerMiddleware);

  return app;
};
