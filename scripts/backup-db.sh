#!/bin/bash
# Backup automático do banco CRM SaaS
# Roda via cron: 0 3 * * * /Users/matheusbatista/Documents/crm-saas/scripts/backup-db.sh

set -euo pipefail

BACKUP_DIR="/Users/matheusbatista/Documents/crm-saas/backups"
DB_URL="postgresql://crm:crm_dev_pass@localhost:5432/crm_db"
PG_DUMP="/opt/homebrew/bin/pg_dump"
DATE=$(date +%Y-%m-%d_%H-%M)
FILE="$BACKUP_DIR/crm_db_$DATE.sql.gz"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Iniciando backup → $FILE"
$PG_DUMP "$DB_URL" --no-owner --no-acl | gzip > "$FILE"

SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ✓ Backup concluído — $SIZE"

# Remove backups mais antigos que KEEP_DAYS dias
find "$BACKUP_DIR" -name "crm_db_*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ✓ Backups antigos removidos (>${KEEP_DAYS}d)"
