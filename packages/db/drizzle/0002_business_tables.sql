-- Fix shops table
ALTER TABLE "shops" RENAME COLUMN "name" TO "shop_name";
--> statement-breakpoint
ALTER TABLE "shops" ALTER COLUMN "shop_name" TYPE varchar(150);
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "owner_name" varchar(100) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "address" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_user_id_unique" UNIQUE("user_id");
--> statement-breakpoint
ALTER TABLE "shops" ALTER COLUMN "owner_name" DROP DEFAULT;
--> statement-breakpoint

-- New tables
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"price" integer NOT NULL,
	"category" varchar(50) NOT NULL,
	"image_url" text,
	"is_combo" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_items" (
	"id" text PRIMARY KEY NOT NULL,
	"combo_id" text NOT NULL,
	"item_id" text NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" serial NOT NULL,
	"shop_id" text NOT NULL,
	"total_amount" integer NOT NULL,
	"note" varchar(500),
	"is_done" boolean DEFAULT false NOT NULL,
	"placed_at" timestamp NOT NULL,
	"done_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"item_name" varchar(100) NOT NULL,
	"item_price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" integer NOT NULL,
	"item_note" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"amount" integer NOT NULL,
	"payment_date" date NOT NULL,
	"note" varchar(300),
	"recorded_by" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"user_id" text,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint

-- Foreign keys
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_combo_id_menu_items_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Indexes
CREATE INDEX "orders_shop_placed_idx" ON "orders" ("shop_id", "placed_at");
--> statement-breakpoint
CREATE INDEX "orders_done_placed_idx" ON "orders" ("is_done", "placed_at");
--> statement-breakpoint
CREATE INDEX "payments_shop_date_idx" ON "payments" ("shop_id", "payment_date");
--> statement-breakpoint
CREATE INDEX "analytics_event_type_idx" ON "analytics_events" ("event_type", "created_at");
