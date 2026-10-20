# Local Monitoring & Observability Setup Guide

## 1. Prerequisites

- Docker Desktop installed on Windows.
- Node.js (v20+ or v22 LTS).
- Ports available:
  - `5432`: PostgreSQL
  - `6379`: Redis
  - `4000`: Amrutam Express API
  - `9090`: Prometheus Server
  - `3001`: Grafana Dashboards
  - `4317` / `4318`: OpenTelemetry Collector (optional)

---

## 2. Docker Compose Profile Architecture

The monitoring infrastructure is decoupled using Docker Compose profiles. The core application can run with or without the monitoring stack.

### Mode A: Core Services Only (Default for Dev & Tests)
Starts only PostgreSQL and Redis:
```bash
docker compose up -d
```
No extra memory or CPU is consumed by monitoring containers.

### Mode B: Full Telemetry Stack (Postgres + Redis + Prometheus + Grafana + OTel)
Activates the `monitoring` profile:
```bash
docker compose --profile monitoring up -d
```

Verify running containers:
```bash
docker compose ps
```
You will see:
- `amrutam_postgres` (Healthy, port 5432)
- `amrutam_redis` (Healthy, port 6379)
- `amrutam_prometheus` (Healthy, port 9090)
- `amrutam_grafana` (Up, port 3001)
- `amrutam_otel_collector` (Up, ports 4317/4318)

---

## 3. Starting the Backend API with Telemetry

1. Ensure `.env` is configured for local observability:
   ```env
   PORT=4000
   NODE_ENV=development
   OTEL_ENABLED=true
   OTEL_SERVICE_NAME=amrutam-telemedicine-backend
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
   METRICS_ENABLED=true
   ```

2. Start the Express development server:
   ```bash
   npm run dev
   ```

3. Verify Prometheus metric scraping:
   Open browser or run curl:
   ```bash
   curl http://localhost:4000/metrics
   ```
   Check that HTTP status is 200 and Prometheus metrics are printed.

---

## 4. Accessing Grafana Dashboards

1. Navigate to: [http://localhost:3001](http://localhost:3001)
2. Log in with the default credentials:
   - **Username**: `admin`
   - **Password**: `admin`
3. Click on **Dashboards** -> **Telemedicine** -> **Amrutam Telemedicine - Production Observability**.
4. The dashboard is pre-provisioned automatically and visualizes:
   - **PostgreSQL & Redis Health Gauges**: Real-time status (UP/DOWN).
   - **HTTP Request Throughput**: Real-time RPS split by route template and HTTP status.
   - **HTTP Latency Quantiles**: p50, p95, and p99 response times.
   - **Rate Limit Rejections**: Spikes in 429 Too Many Requests.
   - **Transactional Outbox Backlog**: Depth of pending events in database.
   - **BullMQ Background Jobs**: Success, failure, and execution rate.
   - **Telemedicine Business Metrics**: Bookings, prescriptions finalized, and payments.

---

## 5. Teardown & Clean Up

To stop only the monitoring services while keeping PostgreSQL and Redis running:
```bash
docker compose --profile monitoring stop prometheus grafana otel-collector
```

To stop all services:
```bash
docker compose --profile monitoring down
```

To remove all persistent data (database, redis, and prometheus metrics volumes):
```bash
docker compose --profile monitoring down -v
```
