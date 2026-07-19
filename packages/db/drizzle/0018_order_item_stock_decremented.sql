-- Track whether each order line actually decremented tracked stock at placement,
-- so a cancel only restores what was really deducted.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "stock_decremented" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- Backfill existing rows to preserve the previous behaviour: mark a line as
-- decremented when its menu item currently tracks stock (the old heuristic).
UPDATE "order_items" oi
SET "stock_decremented" = true
FROM "menu_items" m
WHERE oi."menu_item_id" = m."id" AND m."stock_quantity" IS NOT NULL;
