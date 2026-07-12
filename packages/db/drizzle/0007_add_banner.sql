CREATE TABLE IF NOT EXISTS "banner" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(100),
	"subtitle" varchar(60),
	"tagline" varchar(150),
	"image_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "banner" ENABLE ROW LEVEL SECURITY;
