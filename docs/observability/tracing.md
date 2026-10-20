# OpenTelemetry Distributed Tracing Guide

## 1. Overview & Architecture

Distributed tracing allows developers and site reliability engineers (SREs) to follow the complete lifecycle of a request as it flows across Express middleware, database queries, Redis caching operations, and background jobs.

Amrutam Pharmaceuticals uses the standard OpenTelemetry SDK (`@opentelemetry/sdk-node`) with official community auto-instrumentations:

```
[Incoming HTTP Request: POST /api/v1/consultations]
    |
    +-- [Span: express.request (Root)]
          |
          +-- [Span: rate_limit.check (Redis)]
          |
          +-- [Span: auth.verify_token (JWT)]
          |
          +-- [Span: consultation.create_transaction (Prisma PostgreSQL)]
          |     |
          |     +-- [Span: SELECT slot FOR UPDATE]
          |     +-- [Span: INSERT INTO "Consultation"]
          |     +-- [Span: INSERT INTO "OutboxEvent"]
          |
          +-- [Outbox Dispatcher Poller]
                |
                +-- [Span: bullmq.add_job (Redis)]
```

---

## 2. Configuration Parameters

Tracing is controlled entirely through environment variables defined in `src/config/env.ts`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `OTEL_ENABLED` | boolean | `false` | Master switch. Keep `false` in development/unit tests for zero overhead. Set `true` in staging/production. |
| `OTEL_SERVICE_NAME` | string | `amrutam-telemedicine-backend` | Logical service name displayed in Grafana Tempo / Jaeger. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | string | `""` | Target OTLP HTTP endpoint (e.g. `http://localhost:4318/v1/traces` or cloud collector). When empty, no network exporter is registered. |

---

## 3. Span Context & Correlation with Structured Logs

To achieve complete correlation across metrics, traces, and logs:
1. **Trace ID Injection**: Pino logger includes a dynamic `mixin` that queries `@opentelemetry/api`:
   ```ts
   mixin() {
     const span = trace.getActiveSpan();
     if (!span) return {};
     const ctx = span.spanContext();
     return {
       trace_id: ctx.traceId,
       span_id: ctx.spanId,
     };
   }
   ```
2. **Log Correlation**: Every log emitted while processing a request contains:
   ```json
   {
     "level": 30,
     "correlationId": "8f943e11-7360-4963-8ef0-c11df527e1f4",
     "requestId": "e932b121-6782-411d-a342-998caecbe7a1",
     "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
     "span_id": "00f067aa0ba902b7",
     "msg": "Consultation created successfully"
   }
   ```
3. **Tri-Pillar Operator Lookup**:
   - Operator finds an error in Prometheus (`status_code="500"`).
   - In Grafana or Loki, searches logs filtered by `correlationId` or `trace_id`.
   - Copies `trace_id` into Grafana Tempo or Jaeger to inspect the exact query span that threw an exception.

---

## 4. Privacy & PHI Masking Rules in Tracing

Trace spans and attributes must **NEVER** capture:
- Passwords or MFA TOTP seeds.
- Authorization bearer tokens or refresh tokens.
- Razorpay webhook HMAC signatures.
- Clinical symptoms, patient medical histories, or prescription notes.

The `withSpan()` utility enforces type-safe string/number/boolean scalar attributes only and forbids raw object dumping.
Health checks (`/healthz`, `/readyz`, `/metrics`) are automatically excluded from tracing via `ignoreIncomingRequestHook` to eliminate spam in trace indices.

---

## 5. Connecting to an OpenTelemetry Collector

In `docker-compose.yml`, an optional OpenTelemetry Collector service is pre-configured:
- OTLP gRPC endpoint: `localhost:4317`
- OTLP HTTP endpoint: `localhost:4318`

To forward spans to a cloud tracing backend (e.g. Honeycomb, Dynatrace, Datadog, or Grafana Cloud Tempo), configure the exporter pipeline in `docker/otel-collector/otel-collector-config.yml`:
```yaml
exporters:
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
```
