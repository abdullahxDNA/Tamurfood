#!/usr/bin/env bash
#
# Back up the production database to a timestamped .sql file in backups/.
#
# One-time setup:
#   1. Install the postgres client if needed:  sudo apt install postgresql-client
#   2. Get your connection string from Supabase:
#        Dashboard → Settings → Database → Connection string → "URI"
#        (it looks like postgresql://postgres:PASSWORD@HOST:5432/postgres)
#
# Run a backup:
#   SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres" ./scripts/backup-db.sh
#
# The backup file lands in backups/ (gitignored — never committed). Keep a copy
# somewhere safe (e.g. Google Drive). Do this weekly while on the free plan.

set -euo pipefail

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
echo "Done → $FILE ($(du -h "$FILE" | cut -f1))"
echo "Tip: copy this file somewhere safe (cloud drive / external disk)."
