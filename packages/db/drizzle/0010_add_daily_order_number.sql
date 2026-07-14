ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "daily_number" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_daily_counters" (
	"order_date" date PRIMARY KEY NOT NULL,
	"last_number" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_daily_counters" ENABLE ROW LEVEL SECURITY;
