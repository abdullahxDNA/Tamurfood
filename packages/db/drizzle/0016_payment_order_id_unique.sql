-- Remove any duplicate tied payments (same order_id) a past accept/pay race may
-- have created, keeping the earliest, so the unique index below can be built.
DELETE FROM "payments" p
USING "payments" q
WHERE p."order_id" IS NOT NULL
  AND p."order_id" = q."order_id"
  AND (p."created_at" > q."created_at"
       OR (p."created_at" = q."created_at" AND p."id" > q."id"));
--> statement-breakpoint
-- At most one tied payment per order. Lump-sum "Record Payment" rows have a
-- NULL order_id and are exempt (partial index).
CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_id_unique" ON "payments" ("order_id") WHERE "order_id" IS NOT NULL;
