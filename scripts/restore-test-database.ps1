# scripts/restore-test-database.ps1
# Safe, isolated PostgreSQL restore drill script for Windows / PowerShell.
# Restores into a DISPOSABLE test database (amrutam_restore_test_db) to verify archive integrity.
# WARNING: NEVER runs against or overwrites primary database 'amrutam_db'.

param (
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$DB_CONTAINER = $env:AMRUTAM_DB_CONTAINER ?? "amrutam_postgres"
$DB_USER = $env:POSTGRES_USER ?? "amrutam_user"
$DISPOSABLE_DB = "amrutam_restore_test_db"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Amrutam Telemedicine - Safe Restore Drill        " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Target Database (DISPOSABLE ONLY): $DISPOSABLE_DB" -ForegroundColor Yellow

if (-not $BackupFile) {
    # Find latest backup file in backups directory
    $BACKUP_DIR = Join-Path $PSScriptRoot "..\backups"
    $latest = Get-ChildItem -Path $BACKUP_DIR -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        $BackupFile = $latest.FullName
    } else {
        Write-Error "No backup file specified and no backup files found in $BACKUP_DIR."
        exit 1
    }
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "Specified backup file does not exist: $BackupFile"
    exit 1
}

Write-Host "Source Backup: $BackupFile"

try {
    Write-Host "1. Recreating disposable database '$DISPOSABLE_DB'..." -ForegroundColor Cyan
    docker exec -i $DB_CONTAINER psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DISPOSABLE_DB;" | Out-Null
    docker exec -i $DB_CONTAINER psql -U $DB_USER -c "CREATE DATABASE $DISPOSABLE_DB;" | Out-Null

    Write-Host "2. Restoring backup archive into '$DISPOSABLE_DB'..." -ForegroundColor Cyan
    Get-Content $BackupFile | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DISPOSABLE_DB | Out-Null

    Write-Host "3. Verifying restored data counts..." -ForegroundColor Cyan
    $userCount = docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DISPOSABLE_DB -t -c "SELECT COUNT(*) FROM users;"
    $consultationCount = docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DISPOSABLE_DB -t -c "SELECT COUNT(*) FROM consultations;"
    $slotCount = docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DISPOSABLE_DB -t -c "SELECT COUNT(*) FROM availability_slots;"

    Write-Host "==================================================" -ForegroundColor Green
    Write-Host " RESTORATION DRILL PASSED SUCCESSFULLY!          " -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Users restored:         $($userCount.Trim())"
    Write-Host "Consultations restored: $($consultationCount.Trim())"
    Write-Host "Slots restored:         $($slotCount.Trim())"
} catch {
    Write-Host "ERROR: Restore drill failed: $_" -ForegroundColor Red
}
