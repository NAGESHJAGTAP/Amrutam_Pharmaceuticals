# Amrutam Telemedicine Platform — Security Controls Checklist & Audit Verification

This document provides a comprehensive audit checklist of all security controls, implementation mechanisms, verification test references, and operational procedures implemented across the Amrutam Telemedicine Platform.

---

## 1. Security Controls Matrix

| Control ID | Category | Security Control Description | Status | Implementation Details | Test / Audit Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-AUTH-01** | Authentication | Strong Password Hashing | **IMPLEMENTED** | Argon2id with memory cost 64MB, 3 iterations, 1 parallelism, 16-byte cryptographically secure salt. | `tests/security/auth.test.ts` |
| **SEC-AUTH-02** | Authentication | Password Complexity Rules | **IMPLEMENTED** | Zod regex validation requiring minimum 8 chars, uppercase, lowercase, number, and special character. | `tests/security/auth.test.ts` |
| **SEC-AUTH-03** | Authentication | Short-Lived Access Tokens | **IMPLEMENTED** | Signed HS256 JWT access tokens with 15-minute expiration window (`JWT_ACCESS_EXPIRY`). | `tests/security/auth.test.ts` |
| **SEC-AUTH-04** | Authentication | Refresh Token Rotation (RTR) | **IMPLEMENTED** | Single-use refresh tokens stored as SHA-256 hashes in PostgreSQL; rotated atomically on refresh. | `tests/security/auth.test.ts`, `tests/security/security-hardening.test.ts` |
| **SEC-AUTH-05** | Authentication | Refresh Token Reuse Detection | **IMPLEMENTED** | If an already revoked token is presented, all active sessions for the user account are immediately terminated. | `tests/security/auth.test.ts`, `tests/security/security-hardening.test.ts` |
| **SEC-AUTH-06** | Authentication | Multi-Factor Authentication (MFA) | **IMPLEMENTED** | RFC 6238 TOTP using `otplib` v13. Pre-auth JWT challenge issued on login when MFA enabled; verified before granting tokens. | `tests/security/auth.test.ts` |
| **SEC-AUTH-07** | Authentication | Session Termination / Logout | **IMPLEMENTED** | `/api/v1/auth/logout` revokes the specific refresh token in PostgreSQL and logs an audit trail event. | `tests/security/auth.test.ts`, `tests/security/security-hardening.test.ts` |
| **SEC-AUTH-08** | Authentication | Password Change Session Revocation | **IMPLEMENTED** | Changing password verifies old password, updates hash, and invalidates all existing refresh tokens in a transaction. | `tests/security/auth.test.ts` |
| **SEC-AUTH-09** | Authentication | MFA Self-Service Recovery | **RECOMMENDED** | Documented limitation: Lost authenticator recovery requires administrator assistance; single-use scratch codes planned. | Documented in Threat Model |
| **SEC-RBAC-01** | Authorization | Role-Based Access Control (RBAC) | **IMPLEMENTED** | `authorize([roles])` middleware enforces `PATIENT`, `DOCTOR`, `ADMIN` permissions on protected endpoints. | `tests/security/auth.test.ts`, `tests/security/prescription-payment.test.ts` |
| **SEC-RBAC-02** | Authorization | Privilege Escalation Defense | **IMPLEMENTED** | Public `/register` endpoint strictly enforces `UserRole.PATIENT`; rejects attempts to self-assign `DOCTOR` or `ADMIN`. | `tests/security/auth.test.ts`, `tests/security/security-hardening.test.ts` |
| **SEC-RBAC-03** | Authorization | Object-Level Ownership (IDOR / BOLA) | **IMPLEMENTED** | `requireOwnershipOrAdmin` and service-level checks prevent cross-user access to profiles, prescriptions, payments, and schedules. | `tests/security/auth.test.ts`, `tests/security/security-hardening.test.ts` |
| **SEC-RBAC-04** | Authorization | Clinical Prescription Boundary | **IMPLEMENTED** | Only the specific doctor assigned to a consultation can create or finalize its prescription. | `tests/security/prescription-payment.test.ts` |
| **SEC-RATE-01** | Rate Limiting | Distributed Redis Rate Limiting | **IMPLEMENTED** | `rate-limit-redis` shared across API instances; coordinates hit counts in Redis cluster via atomic LUA scripts. | `tests/security/security-hardening.test.ts` |
| **SEC-RATE-02** | Rate Limiting | Tiered Endpoint Limits | **IMPLEMENTED** | Auth: 15/15m; MFA: 10/15m; Password: 5/15m; Refresh: 30/15m; Booking: 20/10m; General: 100/15m. | `tests/security/security-hardening.test.ts` |
| **SEC-RATE-03** | Rate Limiting | Standard HTTP 429 & Retry-After | **IMPLEMENTED** | Returns RFC 7807 compliant error with `TOO_MANY_REQUESTS` code and standard `Retry-After` response header. | `tests/security/security-hardening.test.ts` |
| **SEC-RATE-04** | Rate Limiting | Explicit Failure Policy (Fail-Closed) | **IMPLEMENTED** | Sensitive auth and booking endpoints enforce `FAIL_CLOSED` policy if Redis is down, preventing unthrottled brute force. | `tests/security/security-hardening.test.ts` |
| **SEC-RATE-05** | Rate Limiting | Proxy Trust Configuration | **IMPLEMENTED** | Express `trust proxy` configured via `TRUST_PROXY` env; ignores spoofed `X-Forwarded-For` headers when proxy trust is disabled. | `tests/security/security-hardening.test.ts` |
| **SEC-HTTP-01** | HTTP Security | Content Security Policy (CSP) | **IMPLEMENTED** | Helmet CSP directives set `default-src 'none'`, `script-src 'self'`, `frame-ancestors 'none'`. | `tests/security/security-hardening.test.ts` |
| **SEC-HTTP-02** | HTTP Security | Strict Transport Security (HSTS) | **IMPLEMENTED** | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` enforced via Helmet. | `tests/security/security-hardening.test.ts` |
| **SEC-HTTP-03** | HTTP Security | Anti-Clickjacking & MIME Sniffing | **IMPLEMENTED** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` headers enforced on all responses. | `tests/security/security-hardening.test.ts` |
| **SEC-HTTP-04** | HTTP Security | CORS Origin Whitelisting | **IMPLEMENTED** | CORS middleware checks incoming origin against configurable `CORS_ORIGIN` allowlist; blocks unauthorized origins. | `tests/unit/app.test.ts` |
| **SEC-HTTP-05** | HTTP Security | Request Body Size Restriction | **IMPLEMENTED** | JSON and URL-encoded body parsers clamped to `100kb`; oversized requests rejected with HTTP 413 `PAYLOAD_TOO_LARGE`. | `tests/security/security-hardening.test.ts` |
| **SEC-HTTP-06** | HTTP Security | Prototype Pollution Defense | **IMPLEMENTED** | Recursive sanitizer rejects request body, query, and parameters containing `__proto__`, `prototype`, or `constructor`. | `tests/security/security-hardening.test.ts` |
| **SEC-DATA-01** | Data & Concurrency | SQL Injection Protection | **IMPLEMENTED** | Prisma ORM uses parameterized prepared statements for all relational operations; raw queries bound. | Verified in migrations and Prisma schemas |
| **SEC-DATA-02** | Data & Concurrency | Anti-Double Booking Guarantees | **IMPLEMENTED** | PostgreSQL `btree_gist` exclusion constraint + partial unique index + `SELECT FOR UPDATE` row locks prevent double bookings. | `tests/concurrency/booking-concurrency.test.ts`, `tests/integration/booking-concurrency-design.test.ts` |
| **SEC-DATA-03** | Data & Concurrency | Prescription Immutability | **IMPLEMENTED** | Finalized prescriptions are permanently locked (`isFinalized: true`); edits rejected with HTTP 400. | `tests/security/prescription-payment.test.ts` |
| **SEC-INTEG-01** | Third-Party Security | Webhook HMAC-SHA256 Verification | **IMPLEMENTED** | Signature verified with constant-time equality check (`crypto.timingSafeEqual`) in `SimulatedPaymentGateway`. | `tests/security/prescription-payment.test.ts`, `tests/security/security-hardening.test.ts` |
| **SEC-INTEG-02** | Third-Party Security | Webhook Replay Protection | **IMPLEMENTED** | Inbound webhooks deduplicated via unique constraint on `eventId` in `WebhookEvent` table; duplicate events return cached 200. | `tests/security/prescription-payment.test.ts` |
| **SEC-OBS-01** | Observability & Privacy | Sensitive Data Log Redaction | **IMPLEMENTED** | Pino logger configured with automatic redaction for tokens, passwords, cookies, webhook signatures, diagnosis, and medications. | `tests/security/security-hardening.test.ts`, `tests/observability/observability.test.ts` |
| **SEC-OBS-02** | Observability & Privacy | Request Tracing & Correlation | **IMPLEMENTED** | `correlationIdMiddleware` assigns unique UUID v4 correlation IDs propagated through HTTP responses, logs, and spans. | `tests/unit/app.test.ts`, `tests/observability/observability.test.ts` |
| **SEC-OBS-03** | Observability & Privacy | Safe Error Responses | **IMPLEMENTED** | Production error handler suppresses internal server error details and stack traces; returns safe generic message with correlation ID. | `tests/security/security-hardening.test.ts` |
| **SEC-OBS-04** | Observability & Privacy | Low-Cardinality Metric Normalization | **IMPLEMENTED** | Route normalizer replaces UUIDs and numerical IDs with `:id` in Prometheus metrics, eliminating label explosion and PHI leakage. | `tests/observability/observability.test.ts` |
| **SEC-OBS-05** | Observability & Privacy | Metrics Endpoint Access Protection | **IMPLEMENTED** | Optional `METRICS_AUTH_TOKEN` enforces Bearer token authentication on `/metrics`; unauthorized requests receive HTTP 401. | `tests/observability/observability.test.ts` |
| **SEC-OBS-06** | Observability & Privacy | OpenTelemetry Attribute Masking | **IMPLEMENTED** | Custom span wrapper `withSpan()` restricts span attributes to non-sensitive scalars; auto-excludes probe endpoints from traces. | `tests/observability/observability.test.ts` |
| **SEC-OPS-01** | Disaster Recovery | Non-Destructive Backup & Verification | **IMPLEMENTED** | Documented `pg_dump` logical backup procedures, isolated verification runbook, and safe PowerShell drill scripts. | `docs/operations/backup-and-disaster-recovery.md` |
| **SEC-OPS-02** | Operations | Dashboard Credential Hardening | **RECOMMENDED** | Default `admin`/`admin` Grafana credentials flagged as development-only; production secret provisioning required. | Documented in `local-monitoring.md` |
| **SEC-AUDIT-01** | Non-Repudiation | Database Audit Logging | **IMPLEMENTED** | `AuditLog` records created for registrations, logins, MFA changes, password updates, bookings, cancellations, prescriptions, and payments. | Verified in `auth.service.ts`, `consultation.service.ts`, `prescription.service.ts` |

---

## 2. Audit Verification Commands

To verify all implemented security and observability controls independently:

```bash
# 1. Execute strict TypeScript compiler check (noEmit)
npm run lint

# 2. Compile the production bundle
npm run build

# 3. Execute unit and observability test suites
npx vitest run tests/observability/observability.test.ts tests/unit/app.test.ts

# 4. Execute the full automated test suite with live containers running
npm test
```
