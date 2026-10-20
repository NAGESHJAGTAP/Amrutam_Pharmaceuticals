# Amrutam Telemedicine Platform — 5-Minute Technical Demo Script

> [!NOTE]
> **Script Preparation Notice**: This document is an engineer's presentation runbook for a 5-minute technical demonstration. It specifies exact terminal commands, API requests, synthetic seed data, and expected outcomes. It does not represent a pre-recorded video link.

---

## Presentation Blueprint & Time Budget (Total: 5 Minutes)

| Timestamp | Segment Title | Core Concept Demonstrated |
| :--- | :--- | :--- |
| **0:00 – 0:30** | System & Architecture Overview | Modular Monolith, PostgreSQL 16, Redis 7, BullMQ, OpenTelemetry |
| **0:30 – 1:15** | Identity, MFA & RBAC | Argon2id, JWT Rotation, RFC 6238 TOTP, Privilege Escalation Defense |
| **1:15 – 2:15** | Doctor Availability & Concurrency Guard | Interval validation, `SELECT FOR UPDATE` row locks, Idempotency replay |
| **2:15 – 3:00** | Prescriptions & Simulated Payments | Clinical immutability (`isFinalized`), HMAC webhook verification, State machine |
| **3:00 – 3:45** | Transactional Outbox & Observability | Poller `SKIP LOCKED`, BullMQ workers, Prometheus `/metrics`, Grafana panels |
| **3:45 – 4:30** | Security Hardening & Disaster Recovery | Fail-Closed rate limiting, Prototype pollution defense, Safe backup scripts |
| **4:30 – 5:00** | Verification & Architectural Trade-offs | Automated test suite execution, trade-offs, and scaling roadmap |

---

## Detailed Step-by-Step Runbook

### Segment 1: Problem & Architecture Overview (0:00 – 0:30)
- **Spoken Narration**:
  *"Hello. Today I am presenting the backend engineering implementation for Amrutam Pharmaceuticals' telemedicine platform. We designed this as an enterprise Modular Monolith using Node.js, Express 5, TypeScript strict mode, PostgreSQL 16, Redis 7, and BullMQ. In healthcare, reliability, data integrity, and patient privacy are paramount. We built this platform to guarantee zero double bookings under heavy concurrency, complete prescription immutability, transactional outbox messaging, and three-pillar observability with zero PHI leakage."*
- **Visual**: Show `docs/architecture.md` high-level architecture diagram.

---

### Segment 2: Registration, Login, MFA & RBAC (0:30 – 1:15)
- **Spoken Narration**:
  *"Let's demonstrate identity security. Passwords are never stored in plaintext; we use Argon2id with 64 megabytes of memory cost. Public registration strictly enforces the PATIENT role to prevent privilege escalation."*
- **Demo Action 1 (Patient Registration)**:
  ```bash
  curl -X POST http://localhost:4000/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "email": "aarav.patel@synthetic.local",
      "password": "PatientSecure#2026!",
      "firstName": "Aarav",
      "lastName": "Patel",
      "phone": "+919800000099"
    }'
  ```
  *Expected Output*: HTTP 201 Created with `{ "success": true, "user": { "role": "PATIENT" } }`.
- **Demo Action 2 (MFA Challenge & Token Rotation)**:
  *"Doctors require Multi-Factor Authentication. When Dr. Aisha logs in, the API returns a pre-auth challenge until verified with an RFC 6238 TOTP 6-digit code. Refresh tokens are single-use SHA-256 hashes; presenting an already-used token immediately revokes all sessions."*

---

### Segment 3: Doctor Availability & Concurrent Booking (1:15 – 2:15)
- **Spoken Narration**:
  *"Next, let's look at doctor availability and appointment scheduling. Doctors can define time slots, and our service prevents overlapping intervals. But what happens when multiple patients try to book the exact same slot at the same second?"*
- **Demo Action 1 (Idempotent Booking Request)**:
  ```bash
  curl -X POST http://localhost:4000/api/v1/consultations \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <PATIENT_ACCESS_TOKEN>" \
    -H "Idempotency-Key: e8b7f2e1-4c12-4e92-bc10-123456789abc" \
    -d '{
      "slotId": "a1b2c3d4-e5f6-7a8b-9c0d-111111111111",
      "doctorId": "d1d2d3d4-e5f6-7a8b-9c0d-222222222222",
      "feeAmount": 600.00
    }'
  ```
  *Expected Output*: HTTP 201 Created with Consultation details.
- **Demo Action 2 (Replaying with Same Idempotency Key)**:
  Execute the identical command again:
  *Expected Output*: Immediate cached HTTP 201 response with matching `idempotencyReplay: true`.
- **Demo Action 3 (Simultaneous Race Condition Demonstration)**:
  *"Behind the scenes, we use an interactive transaction with `SELECT ... FOR UPDATE` on the slot row. Exactly one transaction successfully transitions the slot to `RESERVED`; any simultaneous concurrent request immediately receives HTTP 409 Conflict without double-booking."*

---

### Segment 4: Prescription Lifecycle & Simulated Payments (2:15 – 3:00)
- **Spoken Narration**:
  *"Once a consultation takes place, only the assigned doctor can draft a prescription. Prescriptions enforce a structured Zod medication schema. Crucially, once the doctor calls `/finalize`, the prescription is permanently locked in the database. Any subsequent modification attempt receives HTTP 400."*
- **Demo Action 1 (Prescription Finalization)**:
  ```bash
  curl -X POST http://localhost:4000/api/v1/prescriptions/<PRESCRIPTION_ID>/finalize \
    -H "Authorization: Bearer <DOCTOR_ACCESS_TOKEN>"
  ```
  *Expected Output*: HTTP 200 OK with `isFinalized: true`.
- **Demo Action 2 (Payment Webhook Verification)**:
  *"For payments, our `SimulatedPaymentGateway` receives HMAC-SHA256 signed webhooks. Signatures are verified using timing-safe comparisons to defeat side-channel attacks, and duplicate event IDs are safely deduplicated."*

---

### Segment 5: Transactional Outbox & Observability Dashboard (3:00 – 3:45)
- **Spoken Narration**:
  *"To guarantee notifications are never lost, we use the Transactional Outbox pattern. Domain state and outbox events are committed together in PostgreSQL. Our background poller queries the table with `SELECT ... FOR UPDATE SKIP LOCKED`, making it safe across horizontal API replicas."*
- **Visual**: Switch browser to Grafana Dashboard (`http://localhost:3001`):
  - Point out **PostgreSQL & Redis Health Gauges** (UP).
  - Point out **HTTP Request Throughput** grouped by route template.
  - Point out **Outbox Backlog Gauge** and **BullMQ Job Processing Rate**.
  - Show that URLs in metrics are sanitized (e.g. `/api/v1/doctors/:id`) to prevent Protected Health Information (PHI) leaks and metric cardinality explosion.

---

### Segment 6: Security Hardening & Disaster Recovery (3:45 – 4:30)
- **Spoken Narration**:
  *"For security hardening, we implemented distributed Redis rate limiting with a defensive dual policy: if Redis experiences an outage, sensitive authentication endpoints **FAIL CLOSED** to stop unthrottled brute-force attacks. We also implemented Helmet CSP, HSTS, prototype pollution sanitization, and 100kb payload clamping.*
  *For business continuity, our operations runbook defines a 15-minute RPO target and non-destructive PowerShell backup scripts that test restoration in disposable databases without risking live data."*
- **Visual**: Briefly show `scripts/backup-database.ps1` and `docs/operations/backup-and-disaster-recovery.md`.

---

### Segment 7: Test Evidence, Trade-offs & Conclusion (4:30 – 5:00)
- **Spoken Narration**:
  *"To verify the system, we execute our automated test suite across unit, integration, concurrency, security, and observability tests. We chose a Modular Monolith over microservices to maintain ACID transactions and operational simplicity while supporting 100,000 daily consultations through horizontal scaling and connection pooling.*
  *Thank you, and I look forward to your questions during the technical interview."*
- **Visual**: Run `npm run lint` and `npm run build` showing 0 errors, and show test suite passes.
