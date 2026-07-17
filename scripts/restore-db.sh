#!/usr/bin/env bash
#
# Restore a Tamurfood database backup (a .sql file from pg_dump / the GitHub
# backup workflow) into a target PostgreSQL database.
#
# See docs/RESTORE.md for the full disaster-recovery runbook. Quick usage:
#
#   ./scripts/restore-db.sh <backup.sql> <target-database-url>
#
# Practise safely against a throwaway Docker database:
#   docker run -d --name tf_restore -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17
#   ./scripts/restore-db.sh backup.sql "postgresql://postgres:pw@127.0.0.1:55432/postgres"
#   # inspect, then:  docker rm -f tf_restore
#
# NOTE: A full Supabase dump restores cleanly into a fresh **Supabase** project
# (its auth/storage/realtime roles + extensions already exist). Restoring into a
# plain Postgres logs harmless errors about missing Supabase roles/extensions —
# the public business tables (orders, shops, payments, …) still restore fine.

set -euo pipefail

FILE="${1:-}"
TARGET_URL="${2:-}"

if [ -z "$FILE" ] || [ -z "$TARGET_URL" ]; then
  echo "Usage: ./scripts/restore-db.sh <backup.sql> <target-database-url>"
  echo
  echo "Example (throwaway Docker DB for practice):"
  echo "  ./scripts/restore-db.sh backup.sql \"postgresql://postgres:pw@127.0.0.1:55432/postgres\""
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "Error: backup file not found: $FILE"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql not found. Either install it (sudo apt install postgresql-client),"
  echo "or restore through a Docker container that has it:"
  echo "  cat \"$FILE\" | docker exec -i <pg-container> psql -U postgres postgres"
  exit 1
fi

echo "Restoring $FILE"
echo "  → $TARGET_URL"
echo "(Any 'role ... does not exist' / extension errors are harmless unless the"
echo " target is Supabase — the public business tables still restore.)"
echo

psql "$TARGET_URL" <"$FILE"

echo
echo "Restore finished. Verify the data came back, e.g.:"
echo "  psql \"$TARGET_URL\" -c 'SELECT count(*) FROM orders;'"
echo "  psql \"$TARGET_URL\" -c 'SELECT shop_name FROM shops;'"
