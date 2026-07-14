CREATE TABLE IF NOT EXISTS "pending_menu_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"type" varchar(10) NOT NULL,
	"proposed_by" text NOT NULL,
	"menu_item_id" text,
	"proposed_data" jsonb,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"created_at" timestamp NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	CONSTRAINT "pending_menu_changes_proposed_by_fk" FOREIGN KEY ("proposed_by") REFERENCES "user"("id") ON DELETE CASCADE,
	CONSTRAINT "pending_menu_changes_reviewed_by_fk" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE SET NULL
);
--> statement-breakpoint
ALTER TABLE "pending_menu_changes" ENABLE ROW LEVEL SECURITY;
