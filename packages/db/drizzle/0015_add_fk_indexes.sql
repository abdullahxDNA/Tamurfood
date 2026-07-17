CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_menu_item_id_idx" ON "order_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_recorded_by_idx" ON "payments" USING btree ("recorded_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_user_id_idx" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_menu_changes_proposed_by_idx" ON "pending_menu_changes" USING btree ("proposed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_menu_changes_reviewed_by_idx" ON "pending_menu_changes" USING btree ("reviewed_by");
