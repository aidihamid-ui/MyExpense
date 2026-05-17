#!/usr/bin/env bash
# backup-db.sh — Back up the MyExpense Postgres database.
# Saves a gzipped dump to /var/backups/myexpense/ and prunes files older than 30 days.
#
# Cron (runs daily at 02:00 as root):
#   0 2 * * * root bash /docker/myexpense/repo/scripts/backup-db.sh >> /var/log/myexpense-backup.log 2>&1

set -euo pipefail

COMPOSE_FILE="/docker/myexpense/repo/docker-compose.yml"
BACKUP_DIR="/var/backups/myexpense"
RETAIN_DAYS=30
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
FILE="$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

# Load POSTGRES_USER / POSTGRES_DB from the production .env
ENV_FILE="/docker/myexpense/repo/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-myexpense}"
POSTGRES_DB="${POSTGRES_DB:-myexpense}"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup → $FILE"
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done — $SIZE"

# Prune old backups
DELETED=$(find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +"$RETAIN_DAYS" -print -delete | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pruned $DELETED backup(s) older than $RETAIN_DAYS days"
