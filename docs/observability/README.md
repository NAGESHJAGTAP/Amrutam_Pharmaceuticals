# Amrutam Telemedicine Backend: Observability & Monitoring Architecture

## 1. Executive Summary

Phase 8 introduces production-grade, three-pillar observability (**Metrics**, **Distributed Tracing**, and **Structured Correlated Logging**) alongside health monitoring for the Amrutam Pharmaceuticals telemedicine platform.

```
       +-------------------------------------------------------+
       |               Incoming Patient / Client               |
       +-------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------------+
|                  Amrutam Express Telemedicine API                       |
|                                                                         |
|  [Correlation Middleware] -> Attaches X-Correlation-ID / X-Request-ID  |
|  [Metrics Middleware]     -> Counts RPS & Latency via Route Templates   |
|  [OpenTelemetry Tracer]   -> Spans HTTP, Prisma & Redis with TraceContext|
|  [Pino Structured Logger] -> Automatic Mixin injects trace_id & span_id |
+-------------------------------------------------------------------------+
       |                         |                          |
       v                         v                          v
+--------------+        +-----------------+       +-------------------+
|  PostgreSQL  |        |      Redis      |       |  BullMQ Workers   |
|  (Prisma ORM)|        | (Rate Limiting) |       | (Outbox & Remind) |
+--------------+        +-----------------+       +-------------------+
       ^                         ^                          ^
       |                         |                          |
+-------------------------------------------------------------------------+
|                  Telemetry Collection & Visualization                   |
|                                                                         |
|  - Prometheus Scraper: Pulls /metrics every 5s                          |
|  - Grafana Dashboard: Real-time visualization of RPS, Latency, Outbox   |
|  - OpenTelemetry Collector: OTLP receiver (4317/4318) for distributed   |
|    trace waterfall spans                                                |
+-------------------------------------------------------------------------+
```

---

## 2. The Three Pillars of Observability

### Pillar 1: Metrics (Prometheus)
- Pull-based scraping via standard `/metrics` endpoint.
- Low-cardinality label design ensuring zero memory leaks or label dimension explosion.
- Strict protection against Protected Health Information (PHI): URLs with patient IDs or consultation IDs are strictly normalized to parameterized route templates (`:id` or `:consultationId`).

### Pillar 2: Distributed Tracing (OpenTelemetry)
- Vendor-neutral OpenTelemetry instrumentation (`@opentelemetry/sdk-node`, `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-express`, `@opentelemetry/instrumentation-ioredis`, `@prisma/instrumentation`).
- Spans track incoming HTTP requests, downstream SQL queries via Prisma, and Redis cache/lock operations.
- Tracing is disabled by default in test/dev (`OTEL_ENABLED=false`) for zero overhead, and activated in production via `OTEL_ENABLED=true` pointing to an OpenTelemetry Collector or Grafana Tempo / Jaeger.

### Pillar 3: Structured Logging & Correlation (Pino)
- Log entries include `correlationId`, `requestId`, `trace_id`, and `span_id`.
- Zero-leak redaction rules automatically strip sensitive data (passwords, tokens, cookies, MFA secrets, webhook signatures, and patient medical diagnoses).
- Safe logging prevents raw error stack traces from ever being returned to API clients.

---

## 3. Directory Layout

- `docs/observability/README.md`: Observability overview and architectural design (this file).
- `docs/observability/metrics.md`: Metric catalog, label definitions, low-cardinality rules, and alert thresholds.
- `docs/observability/tracing.md`: OpenTelemetry configuration, span context propagation, OTLP exporters, and collector setup.
- `docs/observability/local-monitoring.md`: Step-by-step local startup guide with Docker Compose, Prometheus, and Grafana.
- `docs/observability/troubleshooting.md`: Runbook for high latency, 5xx spikes, Redis/Postgres outages, and queue worker backlog.

---

## 4. Privacy & Regulatory Notice

> [!WARNING]
> Implementing observability, metrics, and tracing controls is an essential technical requirement for security and operations. However, technical observability tools alone **do not constitute or guarantee compliance** with healthcare privacy frameworks such as HIPAA, DISHA (India), or GDPR. Compliance requires organizational policies, business associate agreements (BAAs), clinical access audits, and patient consent mechanisms.
