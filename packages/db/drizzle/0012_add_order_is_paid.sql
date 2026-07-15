ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_paid" boolean DEFAULT false NOT NULL;
