# Database Restore Runbook

How to bring Tamurfood's data back from a backup. Backups are produced every 6h
by the GitHub Actions workflow in the private `tamurfood-backups-DB` repo
(`pg_dump` → `.sql`, kept 14 days as build artifacts).

> **This procedure is tested.** A `pg_dump` → restore round-trip was verified to
> bring back all tables and rows intact. See `scripts/restore-db.sh`.

---

## A. Real disaster recovery (production database is lost)

1. **Create a new Supabase project** — same region as before (`ap-southeast-1`).
   A fresh Supabase project already has the `auth`/`storage`/`realtime` roles,
   schemas, and extensions the dump expects, so it restores cleanly.

2. **Get the new project's connection string:**
   Supabase Dashboard → **Settings → Database → Connection string → URI**

   ```
   postgresql://postgres:PASSWORD@HOST:5432/postgres
   ```

3. **Get the latest backup file:**
   GitHub → **`tamurfood-backups-DB`** repo → **Actions** → newest green run →
   scroll to **Artifacts** → download `db-backup-…` → unzip → `tamurfood-*.sql`.

4. **Restore it:**

   ```bash
   ./scripts/restore-db.sh tamurfood-YYYYMMDD-HHMMSS.sql \
     "postgresql://postgres:PASSWORD@HOST:5432/postgres"
   ```

5. **Point the app at the new database:** update `DATABASE_URL` (and the
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `VITE_SUPABASE_*` values) in
   Railway to the new project, then redeploy.

6. **Verify:**
   ```bash
   psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" -c 'SELECT count(*) FROM orders;'
   psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" -c 'SELECT shop_name FROM shops;'
   ```

---

## B. Practising the drill safely (no risk to anything)

Restore a backup into a **throwaway Docker database**, inspect it, then delete it.

```bash
# 1. Start a disposable Postgres (matches production's major version)
docker run -d --name tf_restore -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17

# 2. Restore a backup into it
./scripts/restore-db.sh backup.sql "postgresql://postgres:pw@127.0.0.1:55432/postgres"
#    (if psql isn't installed locally, restore through the container instead:)
#    cat backup.sql | docker exec -i tf_restore psql -U postgres postgres

# 3. Look at the data
docker exec tf_restore psql -U postgres -c "SELECT count(*) FROM orders;"
docker exec tf_restore psql -U postgres -c "SELECT shop_name FROM shops;"

# 4. Throw it away
docker rm -f tf_restore
```

Restoring a full Supabase dump into **plain** Postgres logs harmless errors about
missing Supabase roles/extensions — the **public** business tables (orders,
shops, payments, menu, users, …) still restore. For a clean, error-free restore,
use a real Supabase project (section A).

---

## Good habits

- Once in a while, **download a backup and open it** (or run section B) to
  confirm it's real and restorable — a backup you've never restored is a hope.
- Keep a copy of at least one recent backup somewhere outside GitHub (e.g. a
  cloud drive), since artifacts auto-expire after 14 days.
