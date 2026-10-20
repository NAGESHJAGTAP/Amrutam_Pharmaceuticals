# Amrutam Telemedicine Platform — Technical Interview Preparation & Defense Guide

This guide equips you with concise, technically precise, and defensible answers to the most probable questions asked by senior engineering interviewers and system architects reviewing this submission.

---

### Q1: Why did you choose a Modular Monolith instead of Microservices?
- **Technical Answer**:
  *"For a telemedicine platform targeting 100,000 daily consultations, a Modular Monolith is the optimal architectural choice. Microservices introduce severe distributed complexity: network latency, distributed transactions (Saga/2PC), and potential consistency failure when reserving consultation slots. With a Modular Monolith, we maintain strict domain boundaries in code (controllers, services, and isolated schemas) while retaining single-database ACID transactions for anti-double-booking guarantees. We can scale the monolith horizontally by running multiple stateless API replicas behind an ingress load balancer."*
- **मराठी सारांश**:
  *Microservices मुळे network latency आणि distributed transaction ची गुंतागुंत वाढते. Modular Monolith मुळे code मध्ये modules वेगळे राहतात आणि database मध्ये ACID transactions वापरून double-booking १००% टाळता येते. हे सहज horizontally scale करता येते.*

---

### Q2: Exactly how is double booking prevented under high concurrency?
- **Technical Answer**:
  *"Double booking is prevented at the database persistence tier using a defense-in-depth approach:
  1. **PostgreSQL Row Locking**: During booking, we initiate an interactive transaction and execute `SELECT * FROM availability_slots WHERE id = :slotId FOR UPDATE`. This acquires an exclusive row-level lock.
  2. **Atomic Status Check**: Exactly one transaction reads `status = 'AVAILABLE'`, updates it to `RESERVED`, and inserts the `Consultation` record.
  3. **Relational Constraints**: The `consultations` table has a `slotId` column with a `UNIQUE` constraint, backed by a unique index. Even if application locking somehow bypassed, PostgreSQL will reject the second insert with a unique constraint violation (error code `P2002`)."*
- **मराठी सारांश**:
  *Database मध्ये `SELECT ... FOR UPDATE` वापरून row lock केला जातो. त्यामुळे एका वेळी फक्त एकाच patient ची booking commit होते. सोबतच `slotId` वर database चा `UNIQUE` constraint असल्यामुळे एकाच slot वर दुसरी booking होणे अशक्य आहे.*

---

### Q3: How does the Idempotency implementation work?
- **Technical Answer**:
  *"We implement an `idempotencyMiddleware` using the standard `Idempotency-Key` HTTP header:
  1. When a request arrives, we calculate a SHA-256 hash of the request method, path, and JSON payload.
  2. We query the `idempotency_records` table in PostgreSQL.
  3. If the key exists and the request hash matches, we bypass controller execution and immediately replay the cached status code and response body with header `X-Cache: HIT`.
  4. If the key exists but the payload hash differs, we reject the request with HTTP 409 Conflict (`Idempotency key payload mismatch`).
  5. For new keys, the response is captured upon completion and stored in PostgreSQL with a 24-hour expiration window."*
- **मराठी सारांश**:
  *Patient ने network drop मुळे एकाच booking चे दोनदा button दाबले तरी `Idempotency-Key` मुळे database मध्ये दोनदा पैसे कट होत नाहीत किंवा दोन bookings तयार होत नाहीत; जुनाच response तात्काळ replay होतो.*

---

### Q4: Why did you implement a Transactional Outbox instead of writing directly to the BullMQ queue?
- **Technical Answer**:
  *"Directly writing to a message queue after a database write is a distributed systems anti-pattern known as the **Dual-Write Problem**. If the database commit succeeds but the network drops before reaching Redis, the notification is permanently lost. Conversely, if the message is enqueued first and the database transaction rolls back, a patient receives an email for a consultation that doesn't exist.
  With the Transactional Outbox pattern, the `OutboxEvent` record is inserted inside the **same atomic PostgreSQL transaction** as the `Consultation`. A background poller scans for pending events using `SELECT ... FOR UPDATE SKIP LOCKED` and reliably forwards them to BullMQ."*
- **मराठी सारांश**:
  *Database आणि Redis दोन्हीवर एकदम write करताना network drop झाला तर डेटा mismatch होतो (Dual-Write issue). म्हणून Consultation commit होताना त्याच database transaction मध्ये Outbox event लिहिला जातो, ज्यामुळे notification कधीही हरवत नाही.*

---

### Q5: How do you handle job retries and prevent duplicate notification delivery?
- **Technical Answer**:
  *"We use BullMQ with deterministic job identifiers:
  1. When the outbox poller adds a job to BullMQ, it sets `jobId: event.id`. BullMQ automatically deduplicates jobs sharing the same ID, preventing duplicate queueing.
  2. Workers are configured with bounded retries: up to 5 attempts using exponential backoff with random jitter (`backoff: { type: 'exponential', delay: 1000 }`).
  3. Handlers are idempotent. For example, before dispatching an appointment reminder, `reminder.worker.ts` verifies whether the consultation was already `CANCELLED` and skips delivery if obsolete.
  4. Poison pills (unrecoverable errors) exhaust retries and move to the Dead-Letter Queue (DLQ) with an alert."*
- **मराठी सारांश**:
  *Outbox event चा UUID हाच BullMQ चा `jobId` असतो, त्यामुळे duplicate job तयार होत नाही. तात्पुरत्या network error साठी ५ वेळा exponential backoff ने retry होते आणि poison pill jobs Dead-Letter Queue मध्ये जातात.*

---

### Q6: How do Authentication, MFA, RBAC, and Refresh Token Rotation work?
- **Technical Answer**:
  *"1. **Passwords**: Hashed with Argon2id using 64MB memory cost, 3 iterations, and 16-byte cryptographically secure salt.
  2. **Access Tokens**: Short-lived (15 minutes) signed HS256 JWTs.
  3. **Refresh Tokens**: Single-use tokens stored as SHA-256 hashes in PostgreSQL. Upon each refresh, the old token is revoked and a new pair is issued (RTR). If a revoked token is presented, the system detects a token theft replay attack and immediately revokes all active sessions for that user account.
  4. **MFA**: RFC 6238 TOTP using `otplib`. When MFA is active, login returns a pre-auth challenge requiring verification of a 6-digit code.
  5. **RBAC**: Handled via `authorize(['DOCTOR', 'ADMIN'])` middleware. Public registration is hardcoded to `UserRole.PATIENT`."*
- **मराठी सारांश**:
  *Argon2id hashing, १५ मिनिटांचे short-lived JWTs, आणि database मध्ये hash केलेले single-use refresh tokens. जर जुना refresh token पुन्हा वापरला गेला, तर security system लगेच सर्व active sessions terminate करते.*

---

### Q7: How are payment webhook signatures and duplicate events handled?
- **Technical Answer**:
  *"We implement a `SimulatedPaymentGateway` that models standard webhook security:
  1. Inbound requests must provide an `X-Webhook-Signature` header computed as HMAC-SHA256 using the shared `PAYMENT_WEBHOOK_SECRET`.
  2. We verify signatures using `crypto.timingSafeEqual` to prevent timing side-channel attacks.
  3. We store processed event IDs in the `WebhookEvent` table under a database `UNIQUE` constraint. Duplicate webhook deliveries are detected on the fast-path and immediately return a cached 200 OK without re-triggering business state transitions."*
- **मराठी सारांश**:
  *Webhook चा HMAC-SHA256 signature timing-safe comparison ने तपासला जातो. Duplicate webhooks रोखण्यासाठी `WebhookEvent` table मध्ये eventId चा unique constraint वापरला जातो.*

---

### Q8: What do Metrics, Traces, and Logs each tell an operator?
- **Technical Answer**:
  *"The three pillars serve complementary diagnostic roles:
  1. **Metrics (Prometheus)**: High-level aggregations that tell us **THAT** a problem is occurring (e.g., HTTP 5xx error rate spiked or p95 latency reached 1.2 seconds).
  2. **Traces (OpenTelemetry)**: Waterfall span execution trees that show us **WHERE** time was spent (e.g., showing a 950ms bottleneck occurred inside a specific Prisma SQL query).
  3. **Structured Logs (Pino)**: Low-level textual context that tells us **WHY** an error occurred (e.g., throwing a `ConflictError` due to a slot reservation collision).
  All three signals are correlated using a common `correlationId` and `trace_id`."*
- **मराठी सारांश**:
  *Metrics सांगतात **काय** बिघडले (Error Rate/Latency), Traces दाखवतात **कुठे** वेळ गेला (DB query की Redis), आणि Logs सांगतात **का** बिघडले (Specific Error Reason). हे तिन्ही `trace_id` ने एकमेकांशी जोडलेले आहेत.*

---

### Q9: What happens if Redis or PostgreSQL becomes unavailable?
- **Technical Answer**:
  *"1. **PostgreSQL Outage**:
     - The `/readyz` probe times out after 2500ms and returns HTTP 503 `NOT_READY`.
     - Container orchestrators stop routing traffic to the instance.
     - The liveness probe `/healthz` continues returning 200 OK because the Node.js event loop is alive.
  2. **Redis Outage**:
     - Distributed rate limiters activate our defensive dual-tier policy:
       - **Sensitive Auth & Booking Endpoints FAIL CLOSED**: Reject requests with HTTP 500/503 to prevent unthrottled brute-force or slot hoarding.
       - **Public Read Routes FAIL OPEN**: Allows patients to view general information while caching is degraded.
     - Outbox events continue writing safely to PostgreSQL and queue up until Redis returns."*
- **मराठी सारांश**:
  *PostgreSQL बंद झाल्यास `/readyz` ५०३ देतो. Redis बंद झाल्यास security साठी sensitive login/booking routes 'Fail-Closed' होतात (म्हणजे बंद होतात जेणेकरून कोणी brute-force करू नये), पण public read routes चालू राहतात.*

---

### Q10: What is simulated versus integrated with real external services?
- **Technical Answer**:
  *"We are completely transparent about system boundaries:
  - **Simulated**: Payment processing is executed via `SimulatedPaymentGateway`. It implements genuine HMAC-SHA256 cryptographic verification and state machine transitions (`PENDING -> COMPLETED -> REFUNDED`), but does not connect to live Razorpay banking rails.
  - **Real & Tested**: PostgreSQL 16 database, Redis 7 caching and rate limiting, Prisma ORM migrations, BullMQ worker queues, OpenTelemetry tracing, Prometheus scraping, and Argon2id password hashing are fully functional, production-grade implementations."*
- **मराठी सारांश**:
  *PostgreSQL, Redis, BullMQ, OpenTelemetry, आणि Security हे सर्व १००% खऱ्या implementation वर चालतात. फक्त Payment Gateway हा simulated आहे (पण cryptographic HMAC checks आणि webhook deduplication पूर्णपणे खरे आहेत).*

---

### Q11: What performance testing remains necessary before launching to production?
- **Technical Answer**:
  *"While mathematical capacity projections confirm the architecture can handle 100,000 daily consultations (~15 peak bookings/sec and ~500 read RPS), empirical load testing is mandatory:
  1. **k6 / Artillery Load Tests**: Simulating 500 concurrent virtual users hitting booking and availability endpoints.
  2. **Database Connection Pool Sizing**: Benchmarking PostgreSQL connection pool saturation under PgBouncer.
  3. **Redis Cluster Failover Drill**: Verifying rate limiter recovery under simulated Redis primary node failure."*
- **मराठी सारांश**:
  *Architecture १००००० daily bookings साठी योग्य आहे, पण live जाण्यापूर्वी k6 किंवा Artillery द्वारे ५०० concurrent users चा load test करणे आणि PgBouncer connection pooling तपासणे गरजेचे आहे.*

---

### Q12: What are the biggest limitations and next improvements?
- **Technical Answer**:
  *"1. **MFA Account Recovery**: Currently requires administrator intervention if a TOTP seed is lost; we should introduce 8 single-use hashed recovery scratch codes.
  2. **Live Payment Provider**: Connect the webhook intake to live Razorpay production webhooks and merchant dashboard.
  3. **Read Replicas**: Route heavy doctor search queries to PostgreSQL read replicas to reserve primary database CPU exclusively for booking transactions."*
- **मराठी सारांश**:
  *पुढील सुधारणा: १) Patient चे MFA device हरवले तर emergency recovery codes देणे, २) Live Razorpay API जोडणे, आणि ३) Doctor search साठी Read Replica वापरणे.*
