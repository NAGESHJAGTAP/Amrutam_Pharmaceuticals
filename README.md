# Amrutam Pharmaceuticals — Telemedicine Backend Engineering Platform

An enterprise-grade, high-concurrency telemedicine backend engineered with **Node.js**, **Express 5**, **TypeScript** (Strict Mode), **PostgreSQL 16**, **Redis 7**, **Prisma ORM**, **BullMQ**, and **OpenTelemetry**.

---

## 1. Quick Start

### 1.1 Prerequisites
- Node.js v20+ or v22 LTS
- Docker Desktop with Docker Compose

### 1.2 Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```

### 1.3 Launch Core Infrastructure (PostgreSQL 16 & Redis 7)
```bash
docker compose up -d
```

### 1.4 Run Database Migrations & Seed Data
```bash
npx prisma migrate deploy
npm run seed
```

### 1.5 Start Development Server
```bash
npm run dev
```
The API server will listen at `http://localhost:4000`.

---

## 2. Local Monitoring & Observability Stack

To launch the full telemetry stack including **Prometheus**, **Grafana**, and the **OpenTelemetry Collector**:
```bash
docker compose --profile monitoring up -d
```
- **Prometheus UI**: [http://localhost:9090](http://localhost:9090)
- **Grafana Dashboards**: [http://localhost:3001](http://localhost:3001) (User: `admin`, Pass: `admin` — development only)
- **Application Metrics**: [http://localhost:4000/metrics](http://localhost:4000/metrics)
- **Liveness Probe**: [http://localhost:4000/healthz](http://localhost:4000/healthz)
- **Readiness Probe**: [http://localhost:4000/readyz](http://localhost:4000/readyz)

---

## 3. Engineering Documentation Directory

Comprehensive technical documentation is organized under [`docs/`](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs):

- **[System Architecture (`docs/architecture.md`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/architecture.md)**:
  Modular monolith design, domain boundaries, database transactions, concurrency guarantees, 100k daily capacity analysis, and 4 detailed Mermaid sequence/state diagrams.
- **[OpenAPI 3.1 Specification (`docs/openapi.yaml`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/openapi.yaml)**:
  Exhaustive OpenAPI 3.1 contract cataloging all endpoints, schemas, authentication schemes, and response models.
- **[Requirements Traceability Matrix (`docs/submission/requirements-matrix.md`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/submission/requirements-matrix.md)**:
  Full mapping of all assignment requirements to source code implementations, tests, and production considerations.
- **[5-Minute Demo Video Script (`docs/submission/demo-script.md`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/submission/demo-script.md)**:
  Exact 5-minute technical presentation runbook with live commands, synthetic data, and expected outcomes.
- **[Interview Defense Guide (`docs/submission/interview-preparation.md`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/submission/interview-preparation.md)**:
  Technical answers to 12 likely reviewer and architect questions in English with Marathi summaries.
- **[STRIDE Threat Model (`docs/security/threat-model.md`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/security/threat-model.md)**:
  STRIDE analysis, BOLA/IDOR prevention, credential stuffing defenses, rate limiter fail-closed policies, webhook cryptographic checks, and PHI protection.
- **[Security Controls Checklist (`docs/security/security-checklist.md`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/security/security-checklist.md)**:
  Exhaustive audit matrix mapping security controls to source implementations and automated test verifications.
- **[Backup & Disaster Recovery Plan (`docs/operations/backup-and-disaster-recovery.md`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/operations/backup-and-disaster-recovery.md)**:
  PostgreSQL logical (`pg_dump`) and physical PITR strategy, Redis state recovery, RPO/RTO targets, isolated restoration runbooks, and disaster recovery scenarios.
- **[Observability & Telemetry (`docs/observability/`)](file:///d:/5semester/Amrutam%20Pharmaceuticals%20assiment/docs/observability/README.md)**:
  Metrics catalog (`metrics.md`), OpenTelemetry distributed tracing (`tracing.md`), local monitoring guide (`local-monitoring.md`), and operations troubleshooting runbook (`troubleshooting.md`).

---

## 4. Verification & Testing

```bash
# 1. Type checking (0 TypeScript errors)
npm run lint

# 2. Production build compilation
npm run build

# 3. Unit and Observability test suites (standalone)
npx vitest run tests/observability/observability.test.ts tests/unit/app.test.ts

# 4. Full test suite (requires running PostgreSQL and Redis containers)
npm test
```

---

## 5. Architectural Implementation Status & Notes

- **Simulated Payment Gateway**: The current codebase models financial transactions via `SimulatedPaymentGateway` implementing HMAC-SHA256 signature verification and idempotent state machine transitions (`PENDING -> COMPLETED -> REFUNDED`). Real external banking connections require production payment provider keys.
- **Anti-Double-Booking**: Enforced at the PostgreSQL level via `btree_gist` slot exclusion constraints, unique consultation slot indexes, and interactive transaction row locks (`SELECT ... FOR UPDATE`).
- **Transactional Outbox**: Events are written atomically with business entities in PostgreSQL and reliably polled using `SELECT ... FOR UPDATE SKIP LOCKED` into BullMQ worker queues.
- **Compliance Disclaimer**: Architectural controls are implemented to protect PHI, but formal HIPAA, DISHA, or GDPR certification requires organizational policies, business associate agreements (BAAs), and third-party audit attestations.
