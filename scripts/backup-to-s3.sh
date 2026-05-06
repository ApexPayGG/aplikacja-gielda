#!/usr/bin/env bash

set -euo pipefail

# Bucket and retention policy are fixed by project requirements.
S3_BUCKET="stockai-backups"
RETENTION_DAYS=30

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

require_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    log "ERROR: Missing required environment variable: ${var_name}"
    exit 1
  fi
}

# Validate required S3 credentials/endpoint configuration.
require_env "S3_ACCESS_KEY"
require_env "S3_SECRET_KEY"
require_env "S3_HOST"

# Database connection values can be overridden from environment.
DB_NAME="${DB_NAME:-stockai}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

TODAY="$(date +%Y-%m-%d)"
BACKUP_FILE="backup-${TODAY}.sql.gz"

S3CMD=(
  s3cmd
  --access_key="${S3_ACCESS_KEY}"
  --secret_key="${S3_SECRET_KEY}"
  --host="${S3_HOST}"
  --host-bucket="%(bucket).${S3_HOST}"
)

log "Starting pg_dump for database '${DB_NAME}'..."
PGHOST="${DB_HOST}" PGPORT="${DB_PORT}" PGUSER="${DB_USER}" \
  pg_dump "${DB_NAME}" | gzip > "${BACKUP_FILE}"
log "Backup archive created: ${BACKUP_FILE}"

log "Uploading backup to s3://${S3_BUCKET}/${BACKUP_FILE}..."
"${S3CMD[@]}" put "${BACKUP_FILE}" "s3://${S3_BUCKET}/${BACKUP_FILE}"
log "Upload completed."

log "Applying retention policy: removing backups older than ${RETENTION_DAYS} days..."
CUTOFF_EPOCH="$(date -d "-${RETENTION_DAYS} days" +%s)"

"${S3CMD[@]}" ls "s3://${S3_BUCKET}/" | while read -r object_date object_time object_size object_path; do
  # Keep only files matching backup-YYYY-MM-DD.sql.gz naming.
  object_name="${object_path##*/}"
  if [[ "${object_name}" =~ ^backup-([0-9]{4}-[0-9]{2}-[0-9]{2})\.sql\.gz$ ]]; then
    backup_date="${BASH_REMATCH[1]}"
    backup_epoch="$(date -d "${backup_date}" +%s || true)"
    if [[ -n "${backup_epoch}" && "${backup_epoch}" -lt "${CUTOFF_EPOCH}" ]]; then
      log "Deleting old backup: ${object_name}"
      "${S3CMD[@]}" del "${object_path}"
    fi
  fi
done

log "Retention cleanup finished."
log "Backup job completed successfully."
