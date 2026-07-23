import { test, expect, describe } from "bun:test";
import { sql, eq } from "drizzle-orm";

// Integration test for the invariant the order route depends on: tracked stock
// is decremented with a guarded UPDATE inside a transaction, so concurrent
// orders can NEVER oversell the last units (see routes/orders.ts).
//
// Needs a real Postgres — runs only when DATABASE_URL is set (locally:
//   `DATABASE_URL=... bun test stock-race`). It's skipped in CI, which has no
// database. The `@tamurfood/db` import is dynamic and lives INSIDE the test so
// merely loading this file (which connects on import) can't fail without a DB.
const dbTest = process.env.DATABASE_URL ? test : test.skip;

describe("order stock race", () => {
  dbTest("never oversells the last units under concurrent orders", async () => {
    const { db } = await import("@tamurfood/db");
    const { menuItems } = await import("@tamurfood/db/schema");

    const id = crypto.randomUUID();
    const INITIAL_STOCK = 5;
    const CONCURRENT_BUYERS = 12; // more buyers than stock

    // Seed a tracked item with limited stock.
    await db.insert(menuItems).values({
      id,
      name: "STOCK_RACE_TEST_ITEM",
      price: 1,
      category: "__test__",
      isAvailable: true,
      isVisible: true,
      stockQuantity: INITIAL_STOCK,
      sortOrder: 0,
      createdAt: new Date(),
    });

    try {
      // Each "order" runs the same atomic, guarded decrement as the route,
      // in its own transaction — fired all at once to force the race.
      const buyOne = () =>
        db.transaction(async (tx) => {
          const rows = (await tx.execute(sql`
              UPDATE "menu_items"
              SET "stock_quantity" = "stock_quantity" - 1
              WHERE "id" = ${id} AND "stock_quantity" >= 1
              RETURNING "id"
            `)) as unknown as unknown[];
          return rows.length > 0;
        });

      const results = await Promise.all(
        Array.from({ length: CONCURRENT_BUYERS }, buyOne),
      );
      const succeeded = results.filter(Boolean).length;

      const [row] = await db
        .select({ stock: menuItems.stockQuantity })
        .from(menuItems)
        .where(eq(menuItems.id, id));

      // Exactly the available units sell — no more — and stock never goes
      // negative. This is the oversell-protection guarantee.
      expect(succeeded).toBe(INITIAL_STOCK);
      expect(row?.stock).toBe(0);
    } finally {
      await db.delete(menuItems).where(eq(menuItems.id, id));
    }
  });
});
