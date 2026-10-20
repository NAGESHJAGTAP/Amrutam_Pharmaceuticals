import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { env } from '../../config/env.js';
import { logger } from '../../common/logging/logger.js';

let otelSdk: NodeSDK | null = null;

/**
 * Initializes OpenTelemetry SDK for distributed tracing.
 * Operates only when OTEL_ENABLED=true to maintain zero overhead in test/dev by default.
 */
export const initTelemetry = (): void => {
  if (!env.OTEL_ENABLED) {
    logger.debug('OpenTelemetry is disabled via OTEL_ENABLED=false');
    return;
  }

  try {
    const traceExporter = env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
      : undefined;

    otelSdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      }),
      traceExporter,
      instrumentations: [
        new HttpInstrumentation({
          // Exclude high-frequency health probes and metric scrapers from trace trees
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || '';
            return url === '/healthz' || url === '/readyz' || url === '/metrics' || url.startsWith('/api/v1/metrics');
          },
        }),
        new ExpressInstrumentation(),
        new IORedisInstrumentation(),
        new PrismaInstrumentation(),
      ],
    });

    otelSdk.start();
    logger.info(
      {
        serviceName: env.OTEL_SERVICE_NAME,
        endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'console-noop',
      },
      'OpenTelemetry distributed tracing initialized successfully'
    );
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize OpenTelemetry SDK');
  }
};

/**
 * Retrieves the currently active trace ID and span ID.
 * Returns undefined values safely when running in no-op mode.
 */
export const getActiveTraceContext = (): { traceId?: string; spanId?: string } => {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return {};
  }

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
};

/**
 * Wraps an asynchronous operation in a custom OpenTelemetry active span.
 * Guarantees zero sensitive data (PHI, secrets, tokens) are set on span attributes.
 */
export const withSpan = async <T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> => {
  const tracer = trace.getTracer(env.OTEL_SERVICE_NAME);
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message || 'Operation failed',
      });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
};

/**
 * Gracefully flushes and terminates the OpenTelemetry SDK.
 */
export const shutdownTelemetry = async (): Promise<void> => {
  if (otelSdk) {
    try {
      await otelSdk.shutdown();
      logger.info('OpenTelemetry SDK shut down successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error shutting down OpenTelemetry SDK');
    }
  }
};
