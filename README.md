# 🌿 Amrutam Telemedicine Platform — Backend Engineering

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20(Strict)-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20%20LTS-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%20Alpine-DC382D.svg?style=for-the-badge&logo=redis)](https://redis.io/)
[![Tests](https://img.shields.io/badge/Vitest-103%2F103%20Passed%20(100%25)-success.svg?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![CI Status](https://img.shields.io/badge/GitHub%20Actions-CI%20Passing-brightgreen.svg?style=for-the-badge&logo=githubactions)](https://github.com/NAGESHJAGTAP/carebridge-telehealth/actions)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=for-the-badge&logo=docker)](https://www.docker.com/)

**An enterprise-grade, high-concurrency telemedicine platform engineered for Amrutam's integrative healthcare ecosystem. Designed for 100,000+ daily consultations with zero double-booking guarantees, clinical prescription immutability, transactional outbox messaging, and full three-pillar observability.**

[Architecture Doc](docs/architecture.md) • [OpenAPI 3.1 Spec](docs/openapi.yaml) • [Threat Model](docs/security/threat-model.md) • [Demo Script](docs/submission/demo-script.md) • [Requirements Matrix](docs/submission/requirements-matrix.md)

</div>

---

## 📑 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture & Data Flow](#2-system-architecture--data-flow)
3. [Role-Based Architecture & Multi-User Workflows](#3-role-based-architecture--multi-user-workflows)
   - [Three-Tier User Roles Hierarchy](#31-three-tier-user-roles-hierarchy)
   - [End-to-End Clinical Lifecycle Flow](#32-end-to-end-clinical-lifecycle-flow)
   - [Doctor Role Deep-Dive](#33-doctor-role-deep-dive)
   - [Patient Role Deep-Dive](#34-patient-role-deep-dive)
   - [Administrator Role Deep-Dive](#35-administrator-role-deep-dive)
   - [RBAC Authorization Matrix](#36-rbac-authorization-matrix)
4. [Core Technical Innovations](#4-core-technical-innovations)
   - [Concurrency Guard & Zero Double-Booking](#41-concurrency-guard--zero-double-booking)
   - [Database-Backed Idempotency Engine](#42-database-backed-idempotency-engine)
   - [Prescription Lifecycle & Clinical Immutability](#43-prescription-lifecycle--clinical-immutability)
   - [Transactional Outbox Pattern & Background Workers](#44-transactional-outbox-pattern--background-workers)
   - [Distributed Sliding-Window Rate Limiting](#45-distributed-sliding-window-rate-limiting)
   - [Zero-Leakage Observability (Metrics, Traces, Logs)](#46-zero-leakage-observability)
5. [Technology Stack](#5-technology-stack)
6. [Database Schema & Core Models](#6-database-schema--core-models)
7. [Quick Start & Setup Runbook](#7-quick-start--setup-runbook)
8. [Running the Test Suite (103/103 Tests Passed)](#8-running-the-test-suite)
9. [Local Monitoring & Grafana Dashboards](#9-local-monitoring--grafana-dashboards)
10. [Interactive Web Experience](#10-interactive-web-experience)
11. [Engineering Documentation Index](#11-engineering-documentation-index)

---

## 1. Executive Summary

Healthcare platforms operate under non-negotiable operational requirements: **data consistency must be absolute**, appointments can **never double-book**, prescriptions must be **legally immutable**, and personal health information (PHI) can **never leak**.

This platform is structured as a **Modular Monolith** in strict TypeScript. Rather than introducing premature microservice fragmentation, domain boundaries are cleanly isolated into cohesive vertical slices with transactional integrity, row-level locking, and decoupled asynchronous event delivery.

### Key Metrics & Targets:
- **Daily Scale Capacity:** Designed and mathematically validated for **100,000+ daily consultations** (~23.1 peak writes/sec, ~92.6 peak reads/sec).
- **Latency Benchmarks:** Read queries target $p95 < 200\text{ms}$; Write transactions target $p95 < 500\text{ms}$.
- **Target Availability:** **99.95%** with automated liveness (`/healthz`) and readiness (`/readyz`) probes.
- **Automated Verification:** **103 exhaustive automated test suites** covering race conditions, security boundaries, payment webhooks, and token replay defenses.

---

## 2. System Architecture & Data Flow

```mermaid
flowchart TB
    subgraph Clients [Client Layer]
        PatientApp["🌐 Patient Web Portal (React / Vite)"]
        DoctorApp["🩺 Doctor Workspace (Clinical Tools)"]
        AdminApp["📊 Admin Dashboard (Analytics & Audit)"]
    end

    subgraph SecurityPerimeter [Security & Defense Perimeter]
        Helmet["🛡️ Helmet HTTP Headers (CSP / HSTS)"]
        Sanitizer["🧹 Prototype Pollution Sanitizer (<100kb)"]
        RateLimiter["⚡ Redis Sliding-Window Rate Limiter (FAIL_CLOSED)"]
        AuthMiddleware["🔐 JWT Access (15m) + RTR Rotation + TOTP MFA"]
    end

    subgraph CoreDomain [Modular Domain Monolith]
        AuthModule["Auth & Identity\n(Argon2id / RBAC)"]
        DoctorModule["Doctor Directory\n(Multi-filter Search)"]
        AvailabilityModule["Availability Engine\n(Interval Overlap Check)"]
        BookingModule["Booking Engine\n(SELECT FOR UPDATE Row-Lock)"]
        PrescriptionModule["Prescription Service\n(Audit Immutability)"]
        PaymentModule["Payment Engine\n(HMAC Webhook State Machine)"]
    end

    subgraph DataStorage [Transactional & Caching Layer]
        PostgreSQL[("🐘 PostgreSQL 16 Primary\n(ACID / Row-Locks / Idempotency)")]
        RedisCache[("⚡ Redis 7 Cache & Locks\n(Sliding Window / Job Queues)")]
        OutboxTable[("📬 Transactional Outbox\n(SELECT FOR UPDATE SKIP LOCKED)")]
    end

    subgraph AsyncPipeline [Reliable Asynchronous Delivery]
        OutboxPoller["🔄 Outbox Dispatcher (500ms Polling)"]
        BullMQQueue["📨 BullMQ Worker Queues (Redis-backed)"]
        NotificationWorker["🔔 Notification Worker (SMS / Email)"]
        ReminderWorker["⏰ Consultation Reminder Scheduler"]
    end

    subgraph ObservabilityStack [Telemetry & Monitoring Layer]
        Prometheus["📈 Prometheus (Metrics Scrape /metrics)"]
        Grafana["📊 Grafana 11.2 (Real-Time Health Panels)"]
        OTelCollector["🔭 OpenTelemetry Collector (Trace Context)"]
        PinoLogger["📜 Pino Structured JSON (Correlation ID)"]
    end

    Clients --> SecurityPerimeter
    SecurityPerimeter --> CoreDomain
    CoreDomain --> PostgreSQL
    CoreDomain --> RedisCache
    CoreDomain --> OutboxTable
    OutboxTable -.-> OutboxPoller
    OutboxPoller --> BullMQQueue
    BullMQQueue --> NotificationWorker
    BullMQQueue --> ReminderWorker
    CoreDomain -.-> PinoLogger
    CoreDomain -.-> Prometheus
    CoreDomain -.-> OTelCollector
    Prometheus --> Grafana
```

---

## 3. Role-Based Architecture & Multi-User Workflows

The Amrutam Telemedicine Platform operates on a **strict Role-Based Access Control (RBAC)** model with three distinct, privileged persona domains: **Patient**, **Doctor**, and **Administrator**. Every incoming HTTP request must pass through our authentication and authorization perimeter before reaching domain business logic.

### 3.1 Three-Tier User Roles Hierarchy

```mermaid
flowchart LR
    subgraph Roles [Three-Tier User Hierarchy]
        direction TB
        PatientRole["👤 PATIENT\n(Healthcare Seeker)"]
        DoctorRole["🩺 DOCTOR\n(Medical Practitioner)"]
        AdminRole["🛡️ ADMIN\n(Platform Compliance)"]
    end

    subgraph AuthLayer [Security & Role Gatekeeper]
        AuthN["🔐 authenticate()\n(Verify JWT Signature & Expiry)"]
        RBAC["🛡️ authorize([roles])\n(Enforce Role Boundaries)"]
        Ownership["🔒 requireOwnershipOrAdmin()\n(Prevent BOLA / IDOR Tampering)"]
    end

    subgraph PatientScope [Patient Privileges]
        P1["🔍 Search & Filter Doctors"]
        P2["📅 Reserve Slots (Anti-Double-Booking)"]
        P3["💳 Simulated Payment Checkout"]
        P4["📄 View Own Medical Prescriptions"]
    end

    subgraph DoctorScope [Doctor Privileges]
        D1["⏰ Manage Availability Slots (No Overlap)"]
        D2["📋 Clinical Consultation Workspace"]
        D3["✍️ Author & Draft Electronic Rx"]
        D4["🔒 Finalize Rx (Permanent Legal Lock)"]
    end

    subgraph AdminScope [Administrator Privileges]
        A1["✅ Verify Practitioner Credentials"]
        A2["📈 Real-Time Platform Analytics"]
        A3["📜 Search Immutable Audit Logs"]
        A4["🔄 Monitor Queues & Disaster Recovery"]
    end

    PatientRole --> AuthN
    DoctorRole --> AuthN
    AdminRole --> AuthN
    AuthN --> RBAC
    RBAC --> Ownership

    Ownership -->|"Role: PATIENT"| PatientScope
    Ownership -->|"Role: DOCTOR"| DoctorScope
    Ownership -->|"Role: ADMIN"| AdminScope
```

---

### 3.2 End-to-End Clinical Lifecycle Flow

The complete journey of a medical consultation from initial registration to legal prescription finalization involves synchronized state transitions across Patient, Doctor, and System:

```mermaid
sequenceDiagram
    autonumber
    actor Patient as 👤 Patient (Aarav)
    actor Doctor as 🩺 Doctor (Dr. Aisha)
    actor Admin as 🛡️ Admin
    participant API as 🚀 Express API
    participant DB as 🐘 PostgreSQL 16
    participant Queue as 📨 BullMQ Worker

    Note over Doctor,API: 1. Doctor Provisions Availability Slots
    Doctor->>API: POST /api/v1/availability/slots (10:00 - 10:30 AM)
    API->>DB: INSERT availability_slots (status = 'AVAILABLE')
    API-->>Doctor: 🟢 Slot Published

    Note over Patient,API: 2. Patient Searches & Books Doctor Slot
    Patient->>API: GET /api/v1/doctors?specialty=Ayurveda&maxFee=700
    API-->>Patient: 📋 Verified Doctor Directory
    Patient->>API: POST /api/v1/consultations/book (Slot 101, Idempotency-Key)
    API->>DB: BEGIN TX -> SELECT FOR UPDATE -> status = 'RESERVED'
    API->>DB: INSERT consultations (status = 'SCHEDULED')
    API->>DB: INSERT outbox_events ('consultation.booked')
    API->>DB: COMMIT TX
    API-->>Patient: 🟢 Consultation Scheduled (CON-2026-...)

    Note over Queue,Doctor: 3. Async Transactional Event Processing
    DB-->>Queue: Outbox Poller reads event (SKIP LOCKED)
    Queue-->>Patient: 🔔 SMS/Email Notification: Appointment Confirmed
    Queue-->>Doctor: 🔔 SMS/Email Notification: New Consultation Scheduled

    Note over Doctor,Patient: 4. Clinical Consultation & Prescription Lifecycle
    Doctor->>API: GET /api/v1/consultations (Inspect patient medical history)
    Doctor->>API: POST /api/v1/prescriptions (Draft Ayurvedic regimen)
    API->>DB: INSERT prescriptions (isFinalized = false, status = 'DRAFT')
    API-->>Doctor: 📝 Prescription Draft Saved
    
    Doctor->>API: POST /api/v1/prescriptions/:id/finalize
    API->>DB: BEGIN TX -> UPDATE prescriptions SET isFinalized = true
    API->>DB: UPDATE consultations SET status = 'COMPLETED'
    API->>DB: INSERT audit_logs ('PRESCRIPTION_FINALIZED')
    API->>DB: COMMIT TX
    API-->>Doctor: 🔒 Prescription Legally Locked & Immutable

    Note over Patient,API: 5. Patient Downloads Finalized Prescription
    Patient->>API: GET /api/v1/prescriptions/:id (Ownership verified)
    API-->>Patient: 📄 Finalized Prescription & Care Plan

    Note over Admin,API: 6. Platform Audit & Operational Analytics
    Admin->>API: GET /api/v1/admin/analytics
    API-->>Admin: 📊 Platform Metrics (Total Bookings, Revenue, Active Doctors)
    Admin->>API: GET /api/v1/admin/audit-logs
    API-->>Admin: 📜 Immutable Compliance Audit Trail (IP, Actor, Action)
```

---

### 3.3 Doctor Role Deep-Dive (`DOCTOR`)
Practitioners represent verified clinical providers within Amrutam's network:
- **Credential Verification:** Medical doctors possess an authenticated profile including license registration (`AYUSH-MH-2015-...`), specialty, consultation fee, and verification status (`VERIFIED`).
- **Availability Management:** Doctors define prospective consultation time windows. The backend runs interval collision algorithms rejecting overlapping start and end times for the same doctor.
- **Clinical Workspace:** Doctors have privileged access to active, scheduled, and past consultations linked specifically to their practitioner ID.
- **Electronic Prescriptions (e-Rx):** Doctors author structured prescriptions adhering to strict Zod clinical models (medication names, dosage, duration, instructions).
- **Clinical Immutability Lock:** When the practitioner finalizes the prescription, `isFinalized` is set to `true`. From this moment onward, database constraints forbid any update or deletion, ensuring tamper-proof legal integrity.
- **Multi-Factor Authentication (MFA):** Mandatory RFC 6238 TOTP challenge on login.

---

### 3.4 Patient Role Deep-Dive (`PATIENT`)
Patients represent health seekers discovering and consulting Ayurvedic doctors:
- **Public Registration:** Patients can onboard via `/api/v1/auth/register`. The backend unconditionally enforces `role: PATIENT` regardless of any client tampering.
- **Practitioner Directory Search:** Multi-parameter search filtered by medical specialty, maximum consultation fee, years of clinical experience, and real-time slot availability.
- **Race-Condition-Free Booking:** Patients reserve appointments backed by row-level locking (`SELECT FOR UPDATE`), guaranteeing zero double-bookings.
- **Protected Medical Data (Anti-BOLA / IDOR):** Patients can **only** inspect their own medical records, consultations, and prescriptions. An unauthorized patient attempting to read another patient's prescription receives an immediate `HTTP 403 Forbidden`.
- **Idempotency Protection:** Clients can safely retry bookings during intermittent network connectivity using the `Idempotency-Key` header without duplicate billing.

---

### 3.5 Administrator Role Deep-Dive (`ADMIN`)
System administrators maintain platform governance, compliance, and clinical quality:
- **Practitioner Credentialing:** Admins review, verify, and activate doctor profiles and medical practice credentials.
- **Executive Analytics:** Real-time visibility into total consultations, platform gross revenue, registered patient count, and active practitioners.
- **Compliance & Audit Inspection:** Complete access to the append-only `audit_logs` table tracking every security-sensitive action with actor ID, IP address, user agent, action timestamp, and correlation ID.
- **Infrastructure Supervision:** Health probe inspection (`/healthz`, `/readyz`), BullMQ worker Dead Letter Queue monitoring, and disaster recovery execution.

---

### 3.6 RBAC Authorization Matrix

| HTTP Endpoint | Target Operation | Required Role | Security Controls & Invariants |
| :--- | :--- | :---: | :--- |
| `POST /api/v1/auth/register` | User Registration | **PUBLIC** | Enforces `role: PATIENT`; Argon2id hash; 15 req/15m limit |
| `POST /api/v1/auth/login` | User Authentication | **PUBLIC** | Issues 15m Access JWT + 7d Single-Use Refresh Token |
| `POST /api/v1/auth/mfa/verify-login` | TOTP MFA Verification | **PUBLIC** | Validates 6-digit TOTP code before granting tokens |
| `GET /api/v1/doctors` | Search Doctors Directory | **PUBLIC** | Route normalized; multi-parameter filter; pagination |
| `GET /api/v1/doctors/:id` | View Doctor Profile & Slots | **PUBLIC** | Public profile viewing; includes upcoming available slots |
| `PATCH /api/v1/doctors/:id` | Update Doctor Professional Info | **DOCTOR, ADMIN** | Doctor can only update their own profile; Admin has full access |
| `POST /api/v1/availability/slots` | Create Availability Slot | **DOCTOR, ADMIN** | Verifies time order ($t_{start} < t_{end}$); rejects overlapping intervals |
| `POST /api/v1/consultations/book` | Book Consultation Slot | **PATIENT, ADMIN** | `SELECT FOR UPDATE` row lock; `Idempotency-Key` check; Outbox emission |
| `POST /api/v1/consultations/:id/cancel` | Cancel Consultation | **PATIENT, DOCTOR, ADMIN** | Caller must be assigned patient/doctor; resets slot to `AVAILABLE` |
| `POST /api/v1/prescriptions` | Create Draft Prescription | **DOCTOR, ADMIN** | Only assigned doctor can draft; Zod medication schema |
| `PATCH /api/v1/prescriptions/:id` | Update Draft Prescription | **DOCTOR, ADMIN** | Allowed only while `isFinalized: false`; rejects edits after finalization |
| `POST /api/v1/prescriptions/:id/finalize` | Finalize Legal Prescription | **DOCTOR, ADMIN** | Sets `isFinalized: true`; transitions consultation to `COMPLETED`; locks permanently |
| `GET /api/v1/prescriptions/:id` | View Prescription by ID | **PATIENT, DOCTOR, ADMIN** | BOLA Defense: Unrelated patients receive `HTTP 403 Forbidden` |
| `GET /api/v1/admin/analytics` | View Platform Business KPIs | **ADMIN** | Aggregates revenue, active doctors, and completed consultations |
| `GET /api/v1/admin/audit-logs` | Query Audit Trails | **ADMIN** | Searchable audit log with IP, correlation ID, and action history |
| `GET /metrics` | Prometheus Metrics Scrape | **ADMIN / OPS** | Low-cardinality route templates; optional Bearer token protection |
| `GET /readyz` | Deep Dependency Readiness Probe | **PUBLIC** | Checks PostgreSQL & Redis with 2500ms bounded timeout |

---

## 4. Core Technical Innovations

### 4.1 Concurrency Guard & Zero Double-Booking
When thousands of patients simultaneously compete for popular doctor slots, standard read-then-write logic causes disastrous double-bookings. We enforce a **two-tier defense**:
1. **PostgreSQL Row-Level Locking:** During slot reservation, the transaction executes:
   ```sql
   SELECT * FROM "availability_slots" 
   WHERE "id" = $1::uuid 
   FOR UPDATE;
   ```
2. **Atomic State Transition:** The slot transitions from `AVAILABLE` to `RESERVED` within the row-locked transaction. If a concurrent transaction attempts to read the same slot, it blocks until the lock is released and then immediately aborts with `HTTP 409 Conflict`.
3. **Database Exclusion Constraints:** Backed by PostgreSQL `btree_gist` exclusion constraints preventing overlapping time intervals for the same doctor.

```mermaid
sequenceDiagram
    autonumber
    actor PatientA as 👤 Patient A
    actor PatientB as 👤 Patient B
    participant API as 🚀 Express API
    participant DB as 🐘 PostgreSQL 16

    Note over PatientA,PatientB: Both submit booking for exact same doctor slot at T = 0ms
    PatientA->>API: POST /api/v1/consultations/book (Slot 101)
    PatientB->>API: POST /api/v1/consultations/book (Slot 101)

    API->>DB: BEGIN TRANSACTION (Patient A)
    API->>DB: SELECT * FROM availability_slots WHERE id = 101 FOR UPDATE
    Note over DB: Patient A acquires EXCLUSIVE ROW LOCK on Slot 101

    API->>DB: BEGIN TRANSACTION (Patient B)
    API->>DB: SELECT * FROM availability_slots WHERE id = 101 FOR UPDATE
    Note over DB: Patient B is BLOCKED waiting for lock release

    API->>DB: UPDATE availability_slots SET status = 'RESERVED' WHERE id = 101
    API->>DB: INSERT INTO consultations (status = 'SCHEDULED')
    API->>DB: COMMIT TRANSACTION (Patient A)
    Note over DB: Lock released for Patient A
    API-->>PatientA: 🟢 HTTP 201 Created (Booking Confirmed)

    Note over DB: Patient B lock acquired, reads status = 'RESERVED'
    API->>DB: ROLLBACK TRANSACTION (Patient B)
    API-->>PatientB: 🔴 HTTP 409 Conflict ("Slot already reserved")
```

---

### 3.2 Database-Backed Idempotency Engine
Network timeouts cause clients to retry payment and booking writes. The platform enforces RFC-compliant idempotency via the `Idempotency-Key` HTTP header:
- **Payload Verification:** Incoming request payloads are hashed with SHA-256 and matched against the stored hash in the `idempotency_records` table.
- **Safe Replay:** If an identical request is re-submitted, the platform bypasses business logic and instantly replays the cached response with `X-Cache-Lookup: HIT`.
- **Mismatched Payload Defense:** If an identical `Idempotency-Key` is presented with altered request parameters, the server aborts with `HTTP 409 Conflict` to defend against replay tampering.

---

### 3.3 Prescription Lifecycle & Clinical Immutability
Medical prescriptions are legal documents subject to strict regulatory compliance:
- **Assigned Doctor Verification:** Only the medical doctor formally assigned to the consultation can author or draft prescriptions (`HTTP 403 Forbidden` for other actors).
- **Zod Schema Validation:** Medications require structured dosages, timings, routes, frequencies, and durations.
- **Permanent Database Locking:** When the doctor invokes `/api/v1/prescriptions/:id/finalize`:
  - `isFinalized` is set to `true`.
  - The linked consultation transitions to `COMPLETED`.
  - **Any future attempt to edit or delete the prescription is permanently rejected** with `HTTP 409 Conflict`.

---

### 3.4 Transactional Outbox Pattern & Background Workers
Dual-write problems (writing to PostgreSQL and publishing to Redis/Kafka in the same request) risk catastrophic data drift if the network drops between operations.
- **Atomic Event Commit:** Outbox events are stored in the `outbox_events` table **inside the exact same ACID database transaction** as the business mutation.
- **Concurrent Polling:** A resilient background poller scans for pending events using:
  ```sql
  SELECT * FROM "outbox_events" 
  WHERE "processedAt" IS NULL 
  ORDER BY "createdAt" ASC 
  LIMIT 50 
  FOR UPDATE SKIP LOCKED;
  ```
  `SKIP LOCKED` allows multiple horizontally scaled API instances to poll concurrently without processing duplicates or deadlocking.
- **BullMQ Workers:** Dispatched into BullMQ with **exponential backoff retry policies (5 attempts)** and Dead Letter Queues (DLQ) for failed delivery.

---

### 3.5 Distributed Sliding-Window Rate Limiting
Brute-force attacks and bot scrapers are repelled by tiered rate limiters backed by Redis:
- **Authentication Endpoints:** 15 requests per 15 minutes (`FAIL_CLOSED`).
- **Consultation Booking:** 20 bookings per 10 minutes (`FAIL_CLOSED`).
- **Public Reads:** 100 requests per minute (`FAIL_OPEN`).
- **Fail-Closed Guarantee:** Sensitive endpoints (login, register) automatically fail closed during Redis outages to defend against unthrottled brute-force credential stuffing.

---

### 3.6 Zero-Leakage Observability
Observability is built with strict privacy compliance:
- **Prometheus Metrics (`/metrics`):** Route normalization strips dynamic IDs (e.g., `/api/v1/doctors/:id` instead of raw UUIDs) to prevent metric cardinality explosion and eliminate PHI leakage.
- **OpenTelemetry Tracing:** Spans track Express middleware, Prisma SQL queries, and Redis operations with trace propagation headers.
- **Pino Structured JSON Logs:** Every request receives a unique `correlationId`. Sensitive headers (`Authorization`, `Cookie`) and passwords are automatically redacted.

---

## 4. Technology Stack

| Layer | Technology | Version | Rationale / Architectural Benefit |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v20+ LTS | Event-driven, asynchronous I/O optimized for I/O-bound web traffic. |
| **Language** | TypeScript | 5.5+ | Strict type safety, zero `any` tolerance across core domain interfaces. |
| **Framework** | Express | 5.0 (Beta) | Native Promise handling in middleware without unhandled rejections. |
| **Database** | PostgreSQL | 16 | ACID transactions, row-level locks (`FOR UPDATE`), and indexing. |
| **ORM** | Prisma | 5.22 | Strongly typed query builder with automated schema migrations. |
| **Cache & Locks** | Redis | 7 (Alpine) | In-memory distributed rate limiting and BullMQ job queue storage. |
| **Background Jobs** | BullMQ | 5.12 | Enterprise Redis queues with exponential backoff and DLQ retries. |
| **Security & Auth** | Argon2id + OTP | 64MB Cost | Memory-hard password hashing and RFC 6238 TOTP Multi-Factor Auth. |
| **Validation** | Zod | 3.23 | Strict schema validation with declarative error formatting. |
| **Telemetry** | Prometheus & OTel | Open Standards | Real-time metrics exposition and distributed tracing. |
| **Test Framework** | Vitest | 2.1 | Fast ESM-native test runner with isolated multi-worker execution. |

---

## 5. Database Schema & Core Models

The database model is defined in [`prisma/schema.prisma`](prisma/schema.prisma) across 8 core domain tables:

```
  ┌────────────────┐         ┌────────────────┐         ┌────────────────────────┐
  │     users      │1 ──── 1 │    profiles    │         │     doctors            │
  │ id (UUID)      │         │ userId (FK)    │    ┌─── │ id (UUID)              │
  │ email, role    │1 ──── 1 │ firstName      │    │    │ userId (FK), specialty │
  │ passwordHash   │───────> │ lastName       │    │    │ consultationFee        │
  └────────────────┘         └────────────────┘    │    └────────────────────────┘
          │ 1                                      │ 1               │ 1
          │                                        │                 │
          ▼ *                                      ▼ *               ▼ *
  ┌────────────────┐                        ┌────────────────────────┐
  │ consultations  │                        │   availability_slots   │
  │ id (UUID)      │                        │ id (UUID), doctorId    │
  │ patientId (FK) │                        │ startTime, endTime     │
  │ doctorId (FK)  │                        │ status (AVAILABLE...)  │
  │ slotId (FK)    │                        └────────────────────────┘
  │ status         │
  └────────────────┘
     │ 1        │ 1
     │          │
     ▼ 1        ▼ 1
┌─────────────┐ ┌─────────────┐
│prescriptions│ │  payments   │
│id (UUID)    │ │id (UUID)    │
│isFinalized  │ │amount,status│
│medications  │ │gatewayRef   │
└─────────────┘ └─────────────┘
```

1. **`users`**: Master authentication, Argon2id hashes, MFA secrets, roles (`PATIENT`, `DOCTOR`, `ADMIN`).
2. **`profiles`**: Personal details, first/last name, phone numbers.
3. **`doctors`**: Medical license numbers, specialties, consultation fees, verification status.
4. **`availability_slots`**: Doctor appointment windows with interval overlap collision guards.
5. **`consultations`**: Clinical bookings with state machine (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
6. **`prescriptions`**: Medication regimens, dosage instructions, and immutable completion lock.
7. **`payments`**: Transaction records, HMAC webhook verification, and refund lifecycles.
8. **`audit_logs`**: Compliance trail recording `actorId`, `action`, `entityType`, `ipAddress`, and `correlationId`.
9. **`outbox_events`**: Transactional outbox records for asynchronous job processing.
10. **`idempotency_records`**: Cached responses and SHA-256 payload hashes for write safety.

---

## 6. Quick Start & Setup Runbook

### 6.1 Prerequisites
- **Node.js**: `v20.12.0` or higher
- **Docker Desktop**: Engine `v24+` with Docker Compose

### 6.2 Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/NAGESHJAGTAP/carebridge-telehealth.git
cd carebridge-telehealth

# 2. Configure environment variables
cp .env.example .env

# 3. Launch PostgreSQL 16 & Redis 7 infrastructure
docker compose up -d postgres redis

# 4. Install backend dependencies
npm install

# 5. Execute Prisma database migrations
npx prisma migrate deploy

# 6. Seed synthetic data (Doctors, Patients, Admin, Slots)
npm run seed

# 7. Start the backend development server
npm run dev
```

The API server will listen on **`http://localhost:4000`**.

### 6.3 Pre-Seeded Demonstration Accounts

| Role | Email Address | Password | Credentials Details |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor.sharma@carebridge.internal` | `Doctor#2026!` | Dr. Aisha Sharma (Ayurveda Specialist, MFA Configured) |
| **Patient** | `aarav.patel@carebridge.internal` | `Patient#2026!` | Aarav Patel (Verified Patient Profile) |
| **Admin** | `admin@carebridge.internal` | `Admin#2026!` | System Administrator (Full Compliance & Audit Access) |

---

## 7. Running the Test Suite

The repository includes **103 automated tests** structured into 9 dedicated suites verifying functional, integration, concurrency, and security invariants:

```bash
# Run all 103 tests in sequence
npm test
```

### Test Suite Breakdown:
```text
✓ tests/unit/app.test.ts (6 tests)
✓ tests/unit/outbox-queue.test.ts (8 tests)
✓ tests/integration/db-health.test.ts (3 tests)
✓ tests/integration/booking-concurrency-design.test.ts (2 tests)
✓ tests/concurrency/booking-concurrency.test.ts (16 tests)
✓ tests/security/auth.test.ts (19 tests)
✓ tests/security/prescription-payment.test.ts (19 tests)
✓ tests/security/security-hardening.test.ts (17 tests)
✓ tests/observability/observability.test.ts (13 tests)

Test Files  9 passed (9)
     Tests  103 passed (103)  ✓ 100% Passed
  Duration  ~31 seconds
```

```bash
# Run strict TypeScript compilation check (0 errors)
npm run lint

# Compile production bundle to dist/
npm run build
```

---

## 8. Local Monitoring & Grafana Dashboards

Launch the integrated observability stack:
```bash
docker compose --profile monitoring up -d
```

- **Prometheus Metric Scraper:** [http://localhost:9090](http://localhost:9090)
- **Grafana Live Dashboards:** [http://localhost:3001](http://localhost:3001) (`admin` / `admin`)
- **Live Health Endpoint:** [http://localhost:4000/healthz](http://localhost:4000/healthz)
- **Deep Readiness Endpoint:** [http://localhost:4000/readyz](http://localhost:4000/readyz)
- **Prometheus Metric Stream:** [http://localhost:4000/metrics](http://localhost:4000/metrics)

---

## 9. Interactive Web Experience

To experience the full interactive frontend portal:
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies and start Vite dev server
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser. Features include:
- **Hero & Specialty Directory:** 4 verified Ayurvedic medical doctor profiles with specialty and fee filters.
- **Quick Demo Login:** One-click instant login for Doctor, Patient, and Admin accounts.
- **Interactive Patient Portal:** Live slot selection, appointment booking, and prescription history inspection.
- **Doctor Consultation Workspace:** Clinical workspace for reviewing patient medical notes, drafting medications, and finalizing legal prescriptions.
- **Admin Analytics Dashboard:** System metrics, active doctor directory, revenue calculations, and audit logs.

---

## 10. Engineering Documentation Index

Detailed specifications and architectural reports are maintained in the [`docs/`](docs/) directory:

| Document | File Path | Scope & Engineering Contents |
| :--- | :--- | :--- |
| **System Architecture** | [`docs/architecture.md`](docs/architecture.md) | Modular Monolith layout, data partitioning, sagas, retry backoff, and 100k daily capacity mathematical analysis. |
| **OpenAPI 3.1 Contract** | [`docs/openapi.yaml`](docs/openapi.yaml) | Complete API catalog documenting all 24+ REST endpoints, parameters, and schemas. |
| **STRIDE Threat Model** | [`docs/security/threat-model.md`](docs/security/threat-model.md) | Threat analysis across Spoofing, Tampering, Repudiation, Information Disclosure, DoS, and Elevation of Privilege. |
| **Security Controls** | [`docs/security/security-checklist.md`](docs/security/security-checklist.md) | Audit checklist verifying Argon2id, RTR, TOTP MFA, BOLA defense, and rate limiter fail-closed policies. |
| **Disaster Recovery** | [`docs/operations/backup-and-disaster-recovery.md`](docs/operations/backup-and-disaster-recovery.md) | Logical backups, physical PITR runbooks, RTO $\le 60$m, RPO $\le 15$m, and non-destructive recovery scripts. |
| **Observability Guide** | [`docs/observability/README.md`](docs/observability/README.md) | Telemetry catalog, route normalization, OpenTelemetry tracer setup, and troubleshooting guide. |
| **Requirements Matrix** | [`docs/submission/requirements-matrix.md`](docs/submission/requirements-matrix.md) | Comprehensive traceability matrix mapping every assignment requirement to code and test verifications. |
| **5-Minute Demo Script** | [`docs/submission/demo-script.md`](docs/submission/demo-script.md) | Minute-by-minute presentation runbook with live terminal commands and visual transitions. |
| **Interview Defense Guide** | [`docs/submission/interview-preparation.md`](docs/submission/interview-preparation.md) | Deep technical answers to 12 architect-level defense questions in English with Marathi summaries. |

---

<div align="center">

**Built with pride for Amrutam Pharmaceuticals.**  
*Engineered for reliability, patient privacy, and clinical scale.*

</div>
