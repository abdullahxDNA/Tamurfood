ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "stock_quantity" integer;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancel_reason" varchar(300);
