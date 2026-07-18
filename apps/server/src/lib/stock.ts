import { sql } from "drizzle-orm";
import { db } from "@tamurfood/db";

// Either the top-level db or an open transaction handle, so callers can restore
// stock atomically with the order-cancel update that triggered it.
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Restore stock for one or more cancelled orders: add each order line's quantity
// back to its menu item. Placement only decremented items that track stock
// (stock_quantity IS NOT NULL), so we only add back to those — untracked items
// were never decremented and are left alone.
//
// Call this INSIDE the same transaction as the cancel status update so the two
// commit (or roll back) together. Safe to call with an empty list.
export async function restoreStockForCancelledOrders(
  executor: DbOrTx,
  orderIds: string[],
): Promise<void> {
  if (orderIds.length === 0) return;

  await executor.execute(sql`
    UPDATE "menu_items" AS m
    SET "stock_quantity" = m."stock_quantity" + agg."qty"
    FROM (
      SELECT "menu_item_id", SUM("quantity") AS "qty"
      FROM "order_items"
      WHERE "order_id" IN (${sql.join(
        orderIds.map((id) => sql`${id}`),
        sql`, `,
      )})
      GROUP BY "menu_item_id"
    ) AS agg
    WHERE m."id" = agg."menu_item_id" AND m."stock_quantity" IS NOT NULL
  `);
}
