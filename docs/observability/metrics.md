# Prometheus Metrics Catalog

## 1. Overview & Architecture

Amrutam Pharmaceuticals telemedicine backend uses `prom-client` to collect, register, and expose production metrics at `/metrics` conforming to the Prometheus exposition text format.

```
+-------------------------------------------------------------+
|                     Prometheus Server                       |
|               (Scrape interval: 5 seconds)                  |
+-------------------------------------------------------------+
                              |
                     HTTP GET /metrics
                              |
+-------------------------------------------------------------+
|              Amrutam Prometheus Registry                    |
|                                                             |
|  - Process & Runtime Metrics (Memory, Event Loop, GC)       |
|  - HTTP Traffic (Requests Total, Duration Histograms)       |
|  - Infrastructure Availability (Database & Redis Gauges)    |
|  - Transactional Outbox (Pending Backlog, Dispatches)       |
|  - BullMQ Queues (Completed, Failed, Processing Latency)    |
|  - Business Domain Activity (Bookings, Prescriptions, Pay)  |
+-------------------------------------------------------------+
```

---

## 2. Low-Cardinality Guarantees & PHI Protection

A primary architectural flaw in healthcare backend metrics is metric label cardinality explosion and leaking Protected Health Information (PHI) through raw URL parameters (e.g. `/api/v1/doctors/e8b7f2e1-4c12...` or patient consultation IDs).

### Anti-Explosion Defense Mechanism
1. Express route templates (`req.route.path`) are matched first to retain canonical paths (e.g., `/api/v1/doctors/:doctorId/availability`).
2. Regex fallback `normalizeRoutePath()` aggressively cleans un-routed paths:
   - UUIDs (`/[0-9a-fA-F-]{36}/`) are converted to `:id`.
   - Numeric identifiers (`/\/\d+(\/|$)/`) are converted to `/:id/`.
   - Query strings (`?token=...&patientName=...`) are stripped completely.
3. Patient IDs, doctor names, medical diagnoses, prescriptions, and session tokens are **strictly forbidden** in metric labels.

---

## 3. Metrics Catalog

### 3.1 HTTP & API Traffic

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `amrutam_http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests handled by the Express engine. |
| `amrutam_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code`, `le` | Request duration in seconds. Buckets: 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s. |
| `amrutam_http_rate_limit_exceeded_total` | Counter | `endpoint_type`, `ip` (anonymized) | Number of requests throttled with HTTP 429. |

### 3.2 Infrastructure & Dependency Health

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `amrutam_database_health_status` | Gauge | `dependency` (`postgres`, `redis`) | 1 if active probe query succeeded, 0 if probe failed or timed out. |
| `amrutam_redis_health_status` | Gauge | None | 1 if Redis ping responds with PONG, 0 otherwise. |
| `amrutam_database_query_duration_seconds` | Histogram | `operation`, `le` | Duration of database operations in seconds. |
| `amrutam_redis_operation_duration_seconds` | Histogram | `operation`, `le` | Latency of Redis caching and distributed lock operations. |

### 3.3 Transactional Outbox & Background Workers

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `amrutam_outbox_backlog_count` | Gauge | None | Number of pending outbox events awaiting queue dispatch. |
| `amrutam_outbox_events_dispatched_total` | Counter | `event_type`, `status` (`success`, `failure`) | Cumulative events polled and pushed to BullMQ. |
| `amrutam_background_jobs_total` | Counter | `queue_name`, `status` (`completed`, `failed`) | BullMQ job executions across notification and reminder queues. |
| `amrutam_background_job_duration_seconds` | Histogram | `queue_name`, `le` | Background job execution latency in seconds. |

### 3.4 Telemedicine Core Business Counters (Zero PHI)

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `amrutam_consultations_booked_total` | Counter | `status` (`success`, `conflict`) | Number of booking attempts resolved. Tracks concurrency conflicts. |
| `amrutam_prescriptions_finalized_total` | Counter | `status` (`success`) | Number of prescriptions locked and signed by doctors. |
| `amrutam_payments_processed_total` | Counter | `event_type`, `status` | Razorpay webhook financial transactions verified and recorded. |

### 3.5 Node.js Runtime & Process Metrics

- `process_resident_memory_bytes`: Physical RAM (Resident Set Size) consumed by the Node.js process.
- `nodejs_heap_space_size_used_bytes`: Heap memory distribution across old, new, and code spaces.
- `nodejs_eventloop_lag_seconds`: Event loop delay histogram, indicating I/O thread starvation or synchronous blocking.
- `process_cpu_user_seconds_total`: Total user CPU time spent in seconds.

---

## 4. Scrape Endpoint Security

### Deployment Policies
- **Development / Internal**: `/metrics` is accessible directly by the local Prometheus container over `host.docker.internal:4000/metrics`.
- **Production Recommendation**:
  1. **Network Isolation**: Do not expose `/metrics` on public ingress controllers or CDNs. Route `/metrics` only through an internal VPC or Kubernetes private service mesh.
  2. **Bearer Token Authentication**: Set `METRICS_AUTH_TOKEN` in production `.env`. The scraper must pass `Authorization: Bearer <METRICS_AUTH_TOKEN>` or header `x-metrics-key: <METRICS_AUTH_TOKEN>`. Unauthorized requests receive HTTP 401.
