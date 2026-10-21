import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const sanitizeDatabaseUrl = (val: unknown): string | undefined => {
  if (typeof val !== 'string') return undefined;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  const match = cleaned.match(/(?:postgres|postgresql):\/\/[^\s'"]+/);
  if (match) {
    return match[0];
  }
  return cleaned.length > 0 ? cleaned : undefined;
};

const sanitizeRedisUrl = (val: unknown): string | undefined => {
  if (typeof val !== 'string') return undefined;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Extract URL if user pasted CLI command like "redis-cli --tls -u redis://..."
  const match = cleaned.match(/(?:redis|rediss):\/\/[^\s'"]+/);
  if (match) {
    let url = match[0];
    if (cleaned.includes('--tls') && url.startsWith('redis://')) {
      url = 'rediss://' + url.slice('redis://'.length);
    }
    return url;
  }
  return cleaned.length > 0 ? cleaned : undefined;
};

/**
 * Environment configuration schema.
 * Ensures all required environment variables are present and valid before startup.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.preprocess(sanitizeDatabaseUrl, z.string().optional()),
  REDIS_URL: z.preprocess(sanitizeRedisUrl, z.string().optional()),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev_jwt_access_secret_do_not_use_in_production_32charsmin!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev_jwt_refresh_secret_do_not_use_in_production_32charsmin!'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  TRUST_PROXY: z.string().default('false'),

  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('dev_payment_webhook_secret_amrutam_2026_safe'),

  // Observability & Telemetry (OpenTelemetry & Prometheus)
  OTEL_ENABLED: z.coerce.boolean().default(false),
  OTEL_SERVICE_NAME: z.string().default('amrutam-telemedicine-backend'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_AUTH_TOKEN: z.string().optional(),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('CRITICAL: Environment validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
