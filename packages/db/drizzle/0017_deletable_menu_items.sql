-- Allow permanently deleting a menu item even after it has been ordered. The
-- order_items snapshot columns (item_name, item_price, line_total) keep order
-- history readable, so we drop the blocking RESTRICT and make the link nullable
-- with ON DELETE SET NULL.
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_menu_item_id_menu_items_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;
