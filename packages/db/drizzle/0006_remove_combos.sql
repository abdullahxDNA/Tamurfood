-- Remove combo functionality
DROP TABLE IF EXISTS "combo_items" CASCADE;
ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "is_combo";
