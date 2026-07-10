CREATE TABLE "menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "menu_categories_name_unique" UNIQUE("name")
);
