import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { Request } from 'express';

/**
 * Dedicated Prometheus metrics registry for Amrutam Telemedicine Platform.
 * Avoids global registry pollution during hot-reloads and parallel test executions.
 */
export const metricsRegistry = new Registry();

// Register Node.js process and runtime metrics (memory, event loop, CPU, GC)
client.collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'amrutam_',
});

// ============================================================================
// HTTP & API METRICS (Low Cardinality)
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'amrutam_http_requests_total',
  help: 'Total number of HTTP requests processed by method, route template, and status code',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'amrutam_http_request_duration_seconds',
  help: 'Histogram of HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRateLimitExceededTotal = new Counter({
  name: 'amrutam_http_rate_limit_exceeded_total',
  help: 'Total number of requests rejected by distributed rate limiters',
  labelNames: ['endpoint_tier', 'policy'] as const,
  registers: [metricsRegistry],
});

// ============================================================================
// DATABASE & CACHE HEALTH METRICS
// ============================================================================

export const databaseHealthStatus = new Gauge({
  name: 'amrutam_database_health_status',
  help: 'Current operational status of critical dependencies (1 = UP, 0 = DOWN)',
  labelNames: ['dependency'] as const, // 'postgres' | 'redis'
  registers: [metricsRegistry],
});

export const redisHealthStatus = new Gauge({
  name: 'amrutam_redis_health_status',
  help: 'Current operational status of Redis cache and rate limiting (1 = UP, 0 = DOWN)',
  registers: [metricsRegistry],
});

export const databaseQueryDurationSeconds = new Histogram({
  name: 'amrutam_database_query_duration_seconds',
  help: 'Latency of database query operations in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const redisOperationDurationSeconds = new Histogram({
  name: 'amrutam_redis_operation_duration_seconds',
  help: 'Latency of Redis cache and lock operations in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

// ============================================================================
// CLINICAL & BUSINESS METRICS (Zero PHI Labels)
// ============================================================================

export const consultationsBookedTotal = new Counter({
  name: 'amrutam_consultations_booked_total',
  help: 'Count of consultation bookings processed, partitioned by outcome',
  labelNames: ['status'] as const, // 'success' | 'conflict'
  registers: [metricsRegistry],
});

export const prescriptionsFinalizedTotal = new Counter({
  name: 'amrutam_prescriptions_finalized_total',
  help: 'Count of clinical prescriptions permanently finalized',
  labelNames: ['status'] as const, // 'success'
  registers: [metricsRegistry],
});

export const paymentsProcessedTotal = new Counter({
  name: 'amrutam_payments_processed_total',
  help: 'Count of financial transactions processed via payment gateway webhook',
  labelNames: ['event_type', 'status'] as const,
  registers: [metricsRegistry],
});

// ============================================================================
// TRANSACTIONAL OUTBOX & BACKGROUND QUEUE METRICS
// ============================================================================

export const outboxEventsDispatchedTotal = new Counter({
  name: 'amrutam_outbox_events_dispatched_total',
  help: 'Total number of transactional outbox events processed',
  labelNames: ['event_type', 'status'] as const, // 'success' | 'failure'
  registers: [metricsRegistry],
});

export const outboxBacklogCount = new Gauge({
  name: 'amrutam_outbox_backlog_count',
  help: 'Number of pending outbox events awaiting queue dispatch',
  registers: [metricsRegistry],
});

export const backgroundJobsTotal = new Counter({
  name: 'amrutam_background_jobs_total',
  help: 'Total number of BullMQ background jobs executed',
  labelNames: ['queue_name', 'status'] as const, // 'completed' | 'failed'
  registers: [metricsRegistry],
});

export const backgroundJobDurationSeconds = new Histogram({
  name: 'amrutam_background_job_duration_seconds',
  help: 'Histogram of BullMQ background job processing duration in seconds',
  labelNames: ['queue_name'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15, 30],
  registers: [metricsRegistry],
});

// ============================================================================
// ROUTE TEMPLATE NORMALIZATION (Low Cardinality Guarantee)
// ============================================================================

const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const NUMERIC_ID_REGEX = /\/\d+(\/|$)/g;

/**
 * Normalizes an incoming request URL into a bounded route template.
 * Strips raw UUIDs, query strings, and numerical IDs to prevent label explosion.
 */
export const normalizeRoutePath = (req: Request): string => {
  if (req.route && typeof req.route.path === 'string') {
    const baseUrl = req.baseUrl || '';
    return `${baseUrl}${req.route.path}`;
  }

  const rawPath = (
    req.originalUrl ||
    (req.baseUrl ? `${req.baseUrl}${req.path || ''}` : req.path) ||
    req.url ||
    '/'
  ).split('?')[0];

  const normalized = rawPath
    .replace(UUID_REGEX, ':id')
    .replace(NUMERIC_ID_REGEX, '/:id$1');

  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
};
