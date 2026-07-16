#!/usr/bin/env bash
#
# Back up the database to a timestamped .sql file in backups/, record the backup
# in the DB (so the admin panel can nudge if it's overdue), and prune old files.
#
# One-time setup:
#   1. Install the postgres client if needed:  sudo apt install postgresql-client
#   2. Get your connection string from Supabase:
#        Dashboard → Settings → Database → Connection string → "URI"
#        (it looks like postgresql://postgres:PASSWORD@HOST:5432/postgres)
#
# Run a backup manually (anytime):
#   SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres" ./scripts/backup-db.sh
#
# Run it automatically every day (cron):
#   1. Save the connection string once, in a file only you can read:
#        printf 'export SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"\n' > ~/.tamurfood-backup.env
#        chmod 600 ~/.tamurfood-backup.env
#   2. Edit your crontab:  crontab -e   and add (runs 02:00 daily):
#        0 2 * * * . ~/.tamurfood-backup.env && cd /ABSOLUTE/PATH/TO/repo && BACKUP_SOURCE=cron ./scripts/backup-db.sh >> /tmp/tamurfood-backup.log 2>&1
#
# Backups land in backups/ (gitignored). Keep a copy somewhere safe (Google
# Drive). Files older than KEEP_DAYS are auto-deleted so the folder stays small.

set -euo pipefail

KEEP_DAYS=14
SOURCE="${BACKUP_SOURCE:-manual}"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL is not set."
  echo
  echo "Get your connection string from Supabase:"
  echo "  Dashboard → Settings → Database → Connection string → \"URI\""
  echo
  echo "Then run:"
  echo "  SUPABASE_DB_URL=\"postgresql://postgres:PASSWORD@HOST:5432/postgres\" ./scripts/backup-db.sh"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump not found. Install it with:  sudo apt install postgresql-client"
  exit 1
fi

mkdir -p backups
FILE="backups/tamurfood-$(date +%Y%m%d-%H%M%S).sql"

echo "Backing up database to $FILE ..."
pg_dump "$SUPABASE_DB_URL" >"$FILE"
SIZE_KB=$(du -k "$FILE" | cut -f1)
echo "Done → $FILE ($(du -h "$FILE" | cut -f1))"

# Record the backup so the admin panel knows it happened (best-effort — never
# fail the backup if this can't run, e.g. before the table exists).
if command -v psql >/dev/null 2>&1; then
  psql "$SUPABASE_DB_URL" -q -c \
    "INSERT INTO backup_log (id, created_at, size_kb, source) VALUES (gen_random_uuid()::text, now(), ${SIZE_KB}, '${SOURCE}');" \
    >/dev/null 2>&1 && echo "Recorded in backup_log." \
    || echo "Note: couldn't record the backup timestamp (is the DB reachable / migrated?)."
fi

# Prune old local backups.
find backups -maxdepth 1 -name 'tamurfood-*.sql' -type f -mtime "+${KEEP_DAYS}" -delete 2>/dev/null || true

echo "Tip: copy $FILE somewhere safe (cloud drive / external disk)."
