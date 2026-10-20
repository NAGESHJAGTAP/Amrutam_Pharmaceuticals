# Amrutam Telemedicine Platform — Backup & Disaster Recovery (DR) Plan

## 1. Executive Summary & Recovery Objectives

In a digital healthcare platform processing sensitive medical records, clinical prescriptions, and consultation scheduling, data integrity and disaster recovery are essential for patient safety, legal compliance, and operational continuity.

This document details the comprehensive backup, restore, and business continuity strategy for the Amrutam Pharmaceuticals backend across **PostgreSQL 16**, **Redis 7**, and the **Express 5 API application tier**.

```
+-----------------------------------------------------------------------------------+
|                        Disaster Recovery Scope & Objectives                       |
+-----------------------------------------------------------------------------------+
| Metric | Proposed Target | Classification & Real-World Caveat                     |
+--------+-----------------+--------------------------------------------------------+
| RPO    | <= 15 minutes   | Proposed Target (Requires continuous WAL archiving).   |
|        | (<= 24 hours    | (Achieved with daily pg_dump logical snapshots alone). |
|        | with snapshot)  |                                                        |
+--------+-----------------+--------------------------------------------------------+
| RTO    | <= 60 minutes   | Proposed Target (Cold stand-by / automated restore).   |
|        |                 | Target based on tested runbooks, NOT an SLA guarantee. |
+-----------------------------------------------------------------------------------+
```

> [!NOTE]
> **RPO and RTO Definitions**:
> - **Recovery Point Objective (RPO)**: The maximum acceptable data loss measured in time preceding an outage (target: $\le 15$ minutes with WAL archiving; $\le 24$ hours with daily snapshots).
> - **Recovery Time Objective (RTO)**: The maximum acceptable duration to restore the system to full operational status following a declared disaster (target: $\le 60$ minutes).
> Both figures are **proposed engineering targets** requiring regular disaster recovery drills; they must not be presented as guaranteed contractual SLAs without multi-region automated infrastructure.

---

## 2. PostgreSQL 16 Backup Architecture

The platform relies on PostgreSQL 16 as its relational source of truth. A dual-tier backup strategy is recommended:

```
+----------------------------------------------------------------------------+
|                          PostgreSQL Backup Strategy                        |
+----------------------------------------------------------------------------+
|  Tier 1: Logical Snapshots (pg_dump)                                       |
|  - Frequency: Daily at 02:00 UTC (low-traffic window)                      |
|  - Format: Custom compressed archive (-Fc) or plain SQL                    |
|  - Purpose: Schema migrations, table-level restores, developer seeds       |
+----------------------------------------------------------------------------+
|  Tier 2: Physical Backups & WAL Archiving (pgBackRest / AWS RDS PITR)      |
|  - Frequency: Weekly full base backup + continuous WAL streaming (5 min)   |
|  - Purpose: Point-in-Time Recovery (PITR) to any second before disaster    |
|  - RPO Protection: Reduces RPO window to <= 15 minutes                     |
+----------------------------------------------------------------------------+
```

### 2.1 Retention & Storage Policy
- **Daily Snapshots**: Retained for 30 days.
- **Weekly Backups**: Retained for 12 weeks.
- **Monthly Backups**: Retained for 7 years (conforming to statutory clinical record retention mandates).
- **Off-Site & Immutability**: Backups are encrypted with AES-256 before transfer to an isolated, multi-region cloud object storage bucket (e.g. AWS S3 with Object Lock / WORM enabled to defend against ransomware).

---

## 3. Redis 7 Persistence & State Recovery

Redis 7 stores distributed rate-limiting counters, token blacklist states, and BullMQ background queues. Data is classified into two distinct tiers:

| Data Type | Persistence Model | Recovery Expectation |
| :--- | :--- | :--- |
| **Distributed Rate Limiting Counters** | Volatile in-memory | **Reconstructable**: Expire naturally after 10–15 minutes. Data loss in an outage has zero business impact beyond temporary rate limit reset. |
| **Idempotency Response Cache** | In-memory + DB backing | **Reconstructable**: The canonical record is permanently stored in PostgreSQL's `idempotency_records` table. Redis acts purely as a fast-path cache. |
| **BullMQ Background Queues** | Append-Only File (AOF) + RDB | **Critical**: Queue jobs represent pending notifications or reminders. Redis container is configured with `appendonly yes` and `appendfsync everysec`. |

### Redis Recovery Invariant
If Redis crashes or suffers storage corruption:
1. Restart Redis with an empty data directory.
2. The Express API reconnects automatically via its exponential reconnection strategy.
3. If pending notification jobs in BullMQ are lost, the **Transactional Outbox Poller** automatically re-dispatches all un-published events (`status = 'PENDING'`) from PostgreSQL.

---

## 4. Application Redeployment & Secrets Recovery

Application servers are completely stateless:
1. **Container Image**: Immutable production image tagged with the Git commit SHA stored in a private container registry.
2. **Environment Configuration**: Secrets (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PAYMENT_WEBHOOK_SECRET`) are **never** committed to version control. They are retrieved from a secure secret store (e.g., AWS Secrets Manager, HashiCorp Vault, or encrypted deployment pipelines).
3. **Prisma Migrations**: Upon container start or release pipeline execution, `npx prisma migrate deploy` verifies that the target database schema matches compiled Prisma models without applying drift.

---

## 5. Step-by-Step Restore Procedure (Isolated Drill Environment)

To guarantee that backup archives are valid without endangering live operational data, restoration drills must **always** be executed in an isolated, disposable target database.

### 5.1 Environment Prerequisites
- A separate database name (e.g., `amrutam_restore_test_db`).
- Access to the encrypted backup file `amrutam_backup_<timestamp>.dump`.
- PostgreSQL CLI tools (`pg_restore` or `psql`).

### 5.2 Restoration Runbook

```powershell
# Step 1: Set configuration variables (Do NOT hardcode secrets)
$DB_HOST = $env:POSTGRES_HOST ?? "localhost"
$DB_PORT = $env:POSTGRES_PORT ?? "5432"
$DB_USER = $env:POSTGRES_USER ?? "amrutam_user"
$TARGET_RESTORE_DB = "amrutam_restore_test_db"
$BACKUP_FILE = "./backups/amrutam_backup_sample.sql"

# Step 2: Terminate existing connections and recreate disposable target database
docker exec -i amrutam_postgres psql -U $DB_USER -c "DROP DATABASE IF EXISTS $TARGET_RESTORE_DB;"
docker exec -i amrutam_postgres psql -U $DB_USER -c "CREATE DATABASE $TARGET_RESTORE_DB;"

# Step 3: Restore the backup archive into the isolated target database
Get-Content $BACKUP_FILE | docker exec -i amrutam_postgres psql -U $DB_USER -d $TARGET_RESTORE_DB

# Step 4: Verify schema migration consistency
docker exec -i amrutam_postgres psql -U $DB_USER -d $TARGET_RESTORE_DB -c "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE rolled_back_at IS NULL;"
```

---

## 6. Post-Restore Data Integrity Verification

Following any database restoration, the operator must execute the following non-destructive verification queries to confirm table health and referential integrity:

```sql
-- 1. Verify User and Role distribution
SELECT role, status, COUNT(*) AS count 
FROM users 
GROUP BY role, status;

-- 2. Verify Doctor and Availability Slot consistency
SELECT d.id, u.email, COUNT(s.id) AS total_slots 
FROM doctors d 
JOIN users u ON d."userId" = u.id 
LEFT JOIN availability_slots s ON d.id = s."doctorId" 
GROUP BY d.id, u.email;

-- 3. Verify Scheduled Consultations and Payments binding
SELECT c.status AS consultation_status, p.status AS payment_status, COUNT(*) 
FROM consultations c 
JOIN payments p ON c.id = p."consultationId" 
GROUP BY c.status, p.status;

-- 4. Verify Finalized Prescriptions Immutability
SELECT "isFinalized", COUNT(*) 
FROM prescriptions 
GROUP BY "isFinalized";

-- 5. Verify Transactional Outbox Backlog & Status
SELECT status, COUNT(*) 
FROM outbox_events 
GROUP BY status;

-- 6. Verify Idempotency Records
SELECT COUNT(*) AS total_cached_idempotent_requests 
FROM idempotency_records;
```

---

## 7. Disaster Recovery Scenarios & Runbooks

### Scenario A: Accidental Deletion / Operator Error
- **Impact**: An administrator accidentally deletes doctor slots or revokes patient accounts.
- **Runbook**:
  1. Determine the exact timestamp $T_{\text{accident}}$ from PostgreSQL audit logs or `AuditLog` table.
  2. Initiate Point-in-Time Recovery (PITR) on a secondary database instance target: $T_{\text{restore}} = T_{\text{accident}} - 1\text{ minute}$.
  3. Export the missing records via targeted SQL `INSERT ... SELECT` into the primary database.

### Scenario B: Database Storage Volume Corruption
- **Impact**: PostgreSQL data volume reports I/O corruption or filesystem failure.
- **Runbook**:
  1. Tear down the corrupted container/volume.
  2. Provision a new volume with uncorrupted storage.
  3. Restore from the most recent valid backup archive (`pg_restore`).
  4. Run `npx prisma migrate deploy` to ensure schema consistency.
  5. Restart Express backend containers.

### Scenario C: Complete Redis Outage
- **Impact**: Redis crashes, loses power, or suffers network partition.
- **Runbook**:
  1. Express rate limiter switches to **FAIL_CLOSED** for auth endpoints, defending against unthrottled attacks.
  2. Restart Redis container with persistent AOF enabled (`appendonly yes`).
  3. Outbox dispatcher automatically scans for un-published events and re-enqueues missing jobs into BullMQ.
  4. Verify `/readyz` probe returns HTTP 200 `READY`.

### Scenario D: Failed Database Schema Migration
- **Impact**: An automated CI/CD deployment runs `npx prisma migrate deploy` with a failing migration that locks tables.
- **Runbook**:
  1. Identify the failing migration name from `_prisma_migrations`.
  2. Execute Prisma migration rollback or issue an explicit forward-patch migration.
  3. If unrecoverable, restore database from the pre-deployment snapshot created immediately before release.

### Scenario E: Regional Datacenter Catastrophe
- **Impact**: Primary cloud datacenter suffers an unrecoverable electrical or network failure.
- **Runbook**:
  1. Declare disaster; notify Lead DevOps and Engineering Manager.
  2. Spin up secondary infrastructure in the designated standby cloud region using Terraform / Docker Compose.
  3. Pull the latest encrypted backup archive from the cross-region replicated storage bucket.
  4. Restore PostgreSQL schema and data.
  5. Deploy Express API containers with environment secrets.
  6. Switch Route 53 / Cloudflare DNS records to the secondary ingress controller.

---

## 8. Safe PowerShell Backup Script for Windows

Below is an automated, non-destructive script for the developer's local environment:

```powershell
# scripts/backup-database.ps1
# Creates a timestamped logical backup of PostgreSQL without modifying live data.

$ErrorActionPreference = "Stop"

$DB_CONTAINER = "amrutam_postgres"
$DB_USER = $env:POSTGRES_USER ?? "amrutam_user"
$DB_NAME = $env:POSTGRES_DB ?? "amrutam_db"
$BACKUP_DIR = "./backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR/amrutam_backup_$TIMESTAMP.sql"

if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

Write-Host "Creating non-destructive logical backup of $DB_NAME from $DB_CONTAINER..." -ForegroundColor Cyan

docker exec -t $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME --clean --if-exists > $BACKUP_FILE

if ((Get-Item $BACKUP_FILE).Length -gt 0) {
    Write-Host "Backup successfully created: $BACKUP_FILE ($((Get-Item $BACKUP_FILE).Length) bytes)" -ForegroundColor Green
} else {
    Write-Error "Backup file is empty. Verify that PostgreSQL container is running."
}
```

---

## 9. Roles, Responsibilities & Periodic Drills

- **Lead DevOps Engineer**: Owns backup automation, encryption keys, S3 replication, and automated alerting on backup job failures.
- **Backend Tech Lead**: Owns schema migration safety, rollback scripts, and post-restore data integrity validation.
- **Engineering Manager**: Authorizes disaster declaration, failover execution, and post-incident reviews.
- **Bi-Annual Restoration Drill**: Every 6 months, a recovery drill must be executed on a clean staging environment without using existing database volumes. The restoration time must be timed and compared against the target RTO ($\le 60$ minutes).
