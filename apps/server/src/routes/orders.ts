import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import { eq, and, desc, gte, lt, sql, inArray } from "drizzle-orm";
import { db } from "@tamurfood/db";
import {
  orders,
  orderItems,
  menuItems,
  analyticsEvents,
} from "@tamurfood/db/schema";
import { requireSession, getShopForUser, type Variables } from "../lib/helpers";
import { restoreStockForCancelledOrders } from "../lib/stock";
import { dhakaDateStartUTC, addDays } from "../lib/time";
import {
  orderEvents,
  type NewOrderEvent,
  type OrderStatusEvent,
  type PaymentEvent,
} from "../lib/order-events";

// Thrown inside the order transaction when a tracked item loses the race for
// its last units, so the whole order rolls back and we report which item.
class StockConflict extends Error {
  itemId: string;
  constructor(itemId: string) {
    super("stock conflict");
    this.itemId = itemId;
  }
}

const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  note: z.string().max(500).optional(),
});

export const ordersRouter = new Hono<{ Variables: Variables }>()
  // POST / — place order
  .post("/", zValidator("json", placeOrderSchema), async (c) => {
    const authErr = requireSession(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const shop = await getShopForUser(session.user.id);
    if (!shop) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const body = c.req.valid("json");

    // Fetch all referenced menu items in one query
    const menuItemIds = body.items.map((i) => i.menuItemId);
    const foundItems = await db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        price: menuItems.price,
        isAvailable: menuItems.isAvailable,
        isVisible: menuItems.isVisible,
        stockQuantity: menuItems.stockQuantity,
      })
      .from(menuItems)
      .where(inArray(menuItems.id, menuItemIds));

    // Check for missing, unavailable, or insufficient-stock items
    const foundMap = new Map(foundItems.map((i) => [i.id, i]));
    const unavailableItems: string[] = [];

    for (const reqItem of body.items) {
      const found = foundMap.get(reqItem.menuItemId);
      // Reject items that are missing, out of stock (isAvailable=false), or
      // hidden from the menu (isVisible=false) — a stale cart or direct API
      // call must not be able to order something the admin has taken down.
      if (!found || !found.isAvailable || !found.isVisible) {
        unavailableItems.push(reqItem.menuItemId);
        continue;
      }
      // Tracked stock: reject up front if fewer are left than requested.
      if (
        found.stockQuantity !== null &&
        found.stockQuantity < reqItem.quantity
      ) {
        unavailableItems.push(reqItem.menuItemId);
      }
    }

    if (unavailableItems.length > 0) {
      return c.json(
        { error: "Some items are unavailable", unavailableItems },
        409,
      );
    }

    // Build order items with price snapshots. stockDecremented records whether
    // this line will actually deduct tracked stock (item was tracked at order
    // time), so a later cancel restores only what was really taken.
    const lineItems = body.items.map((reqItem) => {
      const item = foundMap.get(reqItem.menuItemId)!;
      return {
        menuItemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        quantity: reqItem.quantity,
        lineTotal: item.price * reqItem.quantity,
        stockDecremented: item.stockQuantity !== null,
      };
    });

    const totalAmount = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

    const orderId = crypto.randomUUID();
    const now = new Date();
    // Bakery-local day (Asia/Dhaka), so the daily number resets at local
    // midnight rather than UTC midnight.
    const bdDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(now); // YYYY-MM-DD

    // Items that track stock are decremented atomically inside the transaction,
    // so concurrent orders can never oversell the last units. If a decrement
    // finds too few left (another order won the race), the order rolls back.
    const trackedItems = body.items.filter(
      (reqItem) => foundMap.get(reqItem.menuItemId)!.stockQuantity !== null,
    );

    let inserted: { id: string; orderNumber: number; dailyNumber: number };
    try {
      inserted = await db.transaction(async (tx) => {
        for (const reqItem of trackedItems) {
          const rows = (await tx.execute(sql`
            UPDATE "menu_items"
            SET "stock_quantity" = "stock_quantity" - ${reqItem.quantity}
            WHERE "id" = ${reqItem.menuItemId}
              AND "stock_quantity" >= ${reqItem.quantity}
            RETURNING "id"
          `)) as unknown as unknown[];
          if (rows.length === 0) throw new StockConflict(reqItem.menuItemId);
        }

        // Atomic next daily number for today (row-locks the day's counter, so
        // concurrent orders get distinct numbers). Rolls back with the order.
        const counterRows = (await tx.execute(sql`
          INSERT INTO "order_daily_counters" ("order_date", "last_number")
          VALUES (${bdDate}, 1)
          ON CONFLICT ("order_date")
          DO UPDATE SET "last_number" = "order_daily_counters"."last_number" + 1
          RETURNING "last_number"
        `)) as unknown as { last_number: number }[];
        const dailyNumber = counterRows[0].last_number;

        const [row] = await tx
          .insert(orders)
          .values({
            id: orderId,
            shopId: shop.id,
            totalAmount,
            note: body.note ?? null,
            isDone: false,
            placedAt: now,
            dailyNumber,
          })
          .returning({ id: orders.id, orderNumber: orders.orderNumber });

        await tx.insert(orderItems).values(
          lineItems.map((li) => ({
            id: crypto.randomUUID(),
            orderId,
            menuItemId: li.menuItemId,
            itemName: li.itemName,
            itemPrice: li.itemPrice,
            quantity: li.quantity,
            lineTotal: li.lineTotal,
            itemNote: null,
            stockDecremented: li.stockDecremented,
          })),
        );

        await tx.insert(analyticsEvents).values({
          id: crypto.randomUUID(),
          eventType: "order_placed",
          userId: session.user.id,
          metadata: { orderId, shopId: shop.id, totalAmount },
          createdAt: now,
        });

        return { ...row, dailyNumber };
      });
    } catch (e) {
      if (e instanceof StockConflict) {
        return c.json(
          { error: "Some items are unavailable", unavailableItems: [e.itemId] },
          409,
        );
      }
      throw e;
    }

    // Emit SSE event for admin live feed
    orderEvents.emit("new_order", {
      orderId: inserted.id,
      orderNumber: inserted.orderNumber,
      shopId: shop.id,
      shopName: shop.shopName,
      totalAmount,
      placedAt: now.toISOString(),
    } satisfies NewOrderEvent);

    return c.json(
      {
        id: inserted.id,
        orderNumber: inserted.orderNumber,
        dailyNumber: inserted.dailyNumber,
        totalAmount,
      },
      201,
    );
  })
  // GET /last — most recent order for the shop (must be before GET / to avoid :id match)
  .get("/last", async (c) => {
    const authErr = requireSession(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const shop = await getShopForUser(session.user.id);
    if (!shop) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const [lastOrder] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        dailyNumber: orders.dailyNumber,
        totalAmount: orders.totalAmount,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .where(eq(orders.shopId, shop.id))
      .orderBy(desc(orders.placedAt))
      .limit(1);

    if (!lastOrder) {
      return c.json(null);
    }

    const items = await db
      .select({
        menuItemId: orderItems.menuItemId,
        itemName: orderItems.itemName,
        itemPrice: orderItems.itemPrice,
        quantity: orderItems.quantity,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, lastOrder.id));

    // Check current availability for each item. A null menuItemId means the item
    // was permanently deleted — it simply can't be reordered (isAvailable=false).
    const menuItemIds = items
      .map((i) => i.menuItemId)
      .filter((id): id is string => id !== null);
    const availabilityRows =
      menuItemIds.length > 0
        ? await db
            .select({ id: menuItems.id, isAvailable: menuItems.isAvailable })
            .from(menuItems)
            .where(inArray(menuItems.id, menuItemIds))
        : [];

    const availMap = new Map(
      availabilityRows.map((r) => [r.id, r.isAvailable]),
    );

    return c.json({
      ...lastOrder,
      items: items.map((i) => ({
        ...i,
        isAvailable: i.menuItemId
          ? (availMap.get(i.menuItemId) ?? false)
          : false,
      })),
    });
  })
  // GET /stream — SSE feed of this shop's order status changes, so the shop's
  // live tracker flips to Accepted/Cancelled the instant staff act (no polling
  // delay). Kept as a raw EventSource on the client (RPC has no streaming).
  .get("/stream", async (c) => {
    const authErr = requireSession(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const shop = await getShopForUser(session.user.id);
    if (!shop) return c.json({ error: "Forbidden" }, 403);

    return streamSSE(c, async (stream) => {
      const statusHandler = async (data: OrderStatusEvent) => {
        // Only push events for this shop's own orders.
        if (data.shopId !== shop.id) return;
        await stream.writeSSE({
          event: "order_status",
          data: JSON.stringify(data),
        });
      };
      const paymentHandler = async (data: PaymentEvent) => {
        if (data.shopId !== shop.id) return;
        await stream.writeSSE({
          event: "payment_recorded",
          data: JSON.stringify(data),
        });
      };
      orderEvents.on("order_status", statusHandler);
      orderEvents.on("payment_recorded", paymentHandler);
      stream.onAbort(() => {
        orderEvents.off("order_status", statusHandler);
        orderEvents.off("payment_recorded", paymentHandler);
      });
      while (true) {
        await stream.sleep(30_000);
        await stream.writeSSE({ event: "ping", data: "" });
      }
    });
  })
  // GET / — order history for shop
  .get("/", async (c) => {
    const authErr = requireSession(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const shop = await getShopForUser(session.user.id);
    if (!shop) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const page = Math.max(1, Number(c.req.query("page") ?? "1"));
    const dateParam = c.req.query("date"); // YYYY-MM-DD
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(orders.shopId, shop.id)];
    if (dateParam) {
      // Interpret the date as a Dhaka calendar day → [00:00, next 00:00) Dhaka,
      // matching the admin order filter (server runs in UTC, so a naive parse
      // would use UTC day boundaries and misplace early-morning orders).
      const start = dhakaDateStartUTC(dateParam);
      const end = addDays(start, 1);
      conditions.push(gte(orders.placedAt, start));
      conditions.push(lt(orders.placedAt, end));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where);

    // Fetch paginated orders
    const orderRows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        dailyNumber: orders.dailyNumber,
        totalAmount: orders.totalAmount,
        note: orders.note,
        isDone: orders.isDone,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
        cancelReason: orders.cancelReason,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(pageSize)
      .offset(offset);

    if (orderRows.length === 0) {
      return c.json({ orders: [], total: count, page, pageSize });
    }

    // Fetch items for those orders
    const orderIds = orderRows.map((o) => o.id);
    const itemRows = await db
      .select({
        orderId: orderItems.orderId,
        itemName: orderItems.itemName,
        itemPrice: orderItems.itemPrice,
        quantity: orderItems.quantity,
        lineTotal: orderItems.lineTotal,
        menuItemId: orderItems.menuItemId,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
      itemsByOrder.get(item.orderId)!.push(item);
    }

    const result = orderRows.map((o) => ({
      ...o,
      items: itemsByOrder.get(o.id) ?? [],
    }));

    return c.json({ orders: result, total: count, page, pageSize });
  })
  // PATCH /:id/cancel — shop cancels their own pending order
  .patch("/:id/cancel", async (c) => {
    const authErr = requireSession(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const shop = await getShopForUser(session.user.id);
    if (!shop) return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const [existing] = await db
      .select({
        isDone: orders.isDone,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
        shopId: orders.shopId,
      })
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.shopId !== shop.id) return c.json({ error: "Forbidden" }, 403);
    if (existing.isDone) return c.json({ error: "Order already done" }, 409);
    if (existing.isCancelled)
      return c.json({ error: "Order already cancelled" }, 409);

    // Cancel the order and return its reserved stock atomically, so a cancel
    // can never lose inventory (or restore it without actually cancelling). The
    // UPDATE is guarded on is_cancelled=false (and is_done=false) so a concurrent
    // double cancel can't restore the same order's stock twice.
    const cancelled = await db.transaction(async (tx) => {
      const rows = await tx
        .update(orders)
        .set({ isCancelled: true, cancelledAt: new Date() })
        .where(
          and(
            eq(orders.id, id),
            eq(orders.isCancelled, false),
            eq(orders.isDone, false),
          ),
        )
        .returning({ id: orders.id });
      if (rows.length === 0) return false;
      await restoreStockForCancelledOrders(tx, [id]);
      return true;
    });

    if (!cancelled) {
      return c.json({ error: "Order already done or cancelled" }, 409);
    }

    // Push to any other open sessions for this shop (e.g. another device).
    orderEvents.emit("order_status", {
      orderId: id,
      shopId: shop.id,
      status: "cancelled",
    } satisfies OrderStatusEvent);

    return c.json({ isCancelled: true });
  });
