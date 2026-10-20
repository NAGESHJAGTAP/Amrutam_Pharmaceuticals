# scripts/backup-database.ps1
# Safe, non-destructive PostgreSQL logical backup script for Windows / PowerShell.
# Requires: Docker Desktop with running container 'amrutam_postgres'

$ErrorActionPreference = "Stop"

$DB_CONTAINER = $env:AMRUTAM_DB_CONTAINER ?? "amrutam_postgres"
$DB_USER = $env:POSTGRES_USER ?? "amrutam_user"
$DB_NAME = $env:POSTGRES_DB ?? "amrutam_db"
$BACKUP_DIR = Join-Path $PSScriptRoot "..\backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = Join-Path $BACKUP_DIR "amrutam_backup_$TIMESTAMP.sql"

if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Amrutam Telemedicine - Database Backup Utility   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Container: $DB_CONTAINER"
Write-Host "Database:  $DB_NAME"
Write-Host "User:      $DB_USER"
Write-Host "Output:    $BACKUP_FILE"
Write-Host "--------------------------------------------------"

try {
    # Non-destructive dump using pg_dump
    docker exec -t $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME --clean --if-exists > $BACKUP_FILE

    if ((Test-Path $BACKUP_FILE) -and ((Get-Item $BACKUP_FILE).Length -gt 0)) {
        $fileSize = (Get-Item $BACKUP_FILE).Length
        Write-Host "SUCCESS: Database backup created successfully!" -ForegroundColor Green
        Write-Host "File size: $fileSize bytes" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Backup file was created but appears empty. Check container logs." -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Backup failed: $_" -ForegroundColor Red
}
