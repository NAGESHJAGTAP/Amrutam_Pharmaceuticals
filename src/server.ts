import { initTelemetry, shutdownTelemetry } from './infrastructure/telemetry/tracer.js';

// Initialize OpenTelemetry distributed tracing prior to application initialization
initTelemetry();

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logging/logger.js';
import { Server } from 'node:http';

const app = createApp();

const server: Server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      port: env.PORT,
      host: env.HOST,
      environment: env.NODE_ENV,
    },
    `🚀 Amrutam Telemedicine Backend running at http://${env.HOST}:${env.PORT}`
  );
});

// Graceful shutdown handling
const handleGracefulShutdown = async (signal: string) => {
  logger.info({ signal }, `Received ${signal}. Initiating graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error occurred while closing HTTP server');
      process.exit(1);
    }

    try {
      await shutdownTelemetry();
    } catch (shutdownErr: any) {
      logger.error({ error: shutdownErr.message }, 'Error shutting down telemetry');
    }

    logger.info('HTTP server and telemetry closed cleanly. Exiting process.');
    process.exit(0);
  });

  // Force close if graceful shutdown exceeds 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection detected');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception detected');
  process.exit(1);
});
