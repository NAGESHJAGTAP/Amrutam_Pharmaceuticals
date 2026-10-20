# Observability & Operations Troubleshooting Runbook

This guide outlines diagnostic procedures for operators, DevOps, and on-call engineers when responding to telemetry alerts on the Amrutam Pharmaceuticals telemedicine backend.

---

## 1. Scenario: High HTTP Latency (p95 > 500ms, p99 > 2s)

### Symptoms
- Prometheus metric `amrutam_http_request_duration_seconds` quantile alerts fire.
- Client applications report spinning loaders or network timeouts.

### Diagnostic Steps
1. **Identify the affected endpoint**:
   Query Prometheus for top 95th percentile latency by route:
   ```promql
   histogram_quantile(0.95, sum(rate(amrutam_http_request_duration_seconds_bucket[5m])) by (route, le))
   ```
2. **Correlate with Database Query Latency**:
   Check if Prisma database queries spiked at the same time:
   ```promql
   histogram_quantile(0.95, sum(rate(amrutam_database_query_duration_seconds_bucket[5m])) by (operation, le))
   ```
3. **Inspect Event Loop Lag**:
   Check if CPU-bound synchronous code is blocking the Node.js single thread:
   ```promql
   nodejs_eventloop_lag_seconds
   ```
   *Action*: If event loop lag is > 50ms, check for synchronous crypto routines (e.g. excessive Argon2id parallel hashing on a low-CPU instance).
4. **Trace Waterfall Inspection**:
   In Grafana Tempo or Jaeger, search for traces on the affected route with `duration > 500ms`. Identify the deepest span (e.g. database table locks during slot booking transaction).

---

## 2. Scenario: Increased HTTP 5xx Error Rate

### Symptoms
- `amrutam_http_requests_total{status_code=~"5.."}` rate increases.
- Dashboard panel "HTTP 4xx & 5xx Error Rates" turns red.

### Diagnostic Steps
1. **Filter structured error logs**:
   Search application logs in Grafana Loki or terminal:
   ```bash
   grep '"level":50' app.log | jq '{correlationId, route, error, msg}'
   ```
2. **Check for Unhandled Exceptions**:
   Look for `Centralized Error Handler caught unexpected error`.
3. **Verify Database Connection Pool**:
   Check PostgreSQL connection exhaustion errors (`Timed out fetching a new connection from the pool`).
   *Action*: Increase connection pool size in `DATABASE_URL?connection_limit=20` or scale database compute.

---

## 3. Scenario: Redis Outage & Rate Limiter Behavior

### Symptoms
- Metric `amrutam_redis_health_status` drops to `0`.
- Health check `/readyz` returns HTTP 503 `NOT_READY`.

### Operational Impact & Rate Limiter Policy
The system uses a defensive dual-tier fail policy:
- **Authentication Endpoints (`/api/v1/auth/*`) FAIL CLOSED**:
  To protect patients against unthrottled credential-stuffing and brute-force attacks during a Redis outage, auth endpoints reject requests with HTTP 500/503.
- **Public Read Endpoints FAIL OPEN**:
  To allow patients to view information even during a cache glitch, read queries continue directly against PostgreSQL.

### Recovery Steps
1. Inspect Redis container logs:
   ```bash
   docker logs amrutam_redis
   ```
2. Test Redis responsiveness manually:
   ```bash
   docker exec -it amrutam_redis redis-cli ping
   ```
3. If Redis OOM occurred, inspect memory configuration (`maxmemory 512mb` and `maxmemory-policy allkeys-lru`).

---

## 4. Scenario: Transactional Outbox Backlog & Queue Stoppage

### Symptoms
- Metric `amrutam_outbox_backlog_count` grows continuously (e.g., > 100).
- Notifications (consultation booking SMS, prescription emails, reminders) are delayed.

### Diagnostic Steps
1. **Check Outbox Poller Worker**:
   Confirm whether the outbox poller is running and executing:
   ```promql
   rate(amrutam_outbox_events_dispatched_total[5m])
   ```
   If rate is `0` while backlog is increasing, the background dispatcher process has stalled or stopped.
2. **Check BullMQ Worker Health**:
   Query job processing rates:
   ```promql
   sum(rate(amrutam_background_jobs_total[5m])) by (queue_name, status)
   ```
   If `status="failed"` is elevated, inspect job failure logs:
   ```bash
   grep '"queue_name":"notifications"' app.log | grep '"status":"failed"'
   ```
3. **Drain Poison-Pill Jobs**:
   BullMQ jobs retry up to 5 times with exponential backoff and jitter. If an unrecoverable payload is failing repeatedly, review the dead-letter queue (DLQ) and resolve schema discrepancies before re-queueing.

---

## 5. Scenario: Consultation Booking Concurrency Conflicts

### Symptoms
- Metric `amrutam_consultations_booked_total{status="conflict"}` spikes.

### Explanation & Resolution
- In Phase 4, the system implemented database-level locking (`SELECT ... FOR UPDATE` and PostgreSQL UNIQUE constraints on `AvailabilitySlot`).
- When two patients simultaneously attempt to reserve the same doctor slot, exactly one succeeds (`status="success"`), and the second receives HTTP 409 Conflict (`status="conflict"`).
- A mild conflict rate is **normal and expected behavior** during peak booking hours for popular doctors. It proves the concurrency guard is protecting against double-booking.
- If conflicts are abnormally high, advise the medical center to expand doctor availability slots.
