CREATE TABLE IF NOT EXISTS "backup_log" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"size_kb" integer,
	"source" varchar(20)
);
--> statement-breakpoint
ALTER TABLE "backup_log" ENABLE ROW LEVEL SECURITY;
