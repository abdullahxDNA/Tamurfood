import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, gte, lt, sql, inArray } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { orders, orderItems, menuItems, analyticsEvents } from "@tamurfood/db/schema";
import { requireSession, getShopForUser, type Variables } from "../lib/helpers";
import { orderEvents, type NewOrderEvent } from "../lib/order-events";

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
      })
      .from(menuItems)
      .where(inArray(menuItems.id, menuItemIds));

    // Check for missing or unavailable items
    const foundMap = new Map(foundItems.map((i) => [i.id, i]));
    const unavailableItems: string[] = [];

    for (const reqItem of body.items) {
      const found = foundMap.get(reqItem.menuItemId);
      if (!found || !found.isAvailable) {
        unavailableItems.push(reqItem.menuItemId);
      }
    }

    if (unavailableItems.length > 0) {
      return c.json(
        { error: "Some items are unavailable", unavailableItems },
        409,
      );
    }

    // Build order items with price snapshots
    const lineItems = body.items.map((reqItem) => {
      const item = foundMap.get(reqItem.menuItemId)!;
      return {
        menuItemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        quantity: reqItem.quantity,
        lineTotal: item.price * reqItem.quantity,
      };
    });

    const totalAmount = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

    const orderId = crypto.randomUUID();
    const now = new Date();

    // Insert order
    const [inserted] = await db
      .insert(orders)
      .values({
        id: orderId,
        shopId: shop.id,
        totalAmount,
        note: body.note ?? null,
        isDone: false,
        placedAt: now,
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    // Insert order items (bulk)
    await db.insert(orderItems).values(
      lineItems.map((li) => ({
        id: crypto.randomUUID(),
        orderId,
        menuItemId: li.menuItemId,
        itemName: li.itemName,
        itemPrice: li.itemPrice,
        quantity: li.quantity,
        lineTotal: li.lineTotal,
        itemNote: null,
      })),
    );

    // Analytics event
    await db.insert(analyticsEvents).values({
      id: crypto.randomUUID(),
      eventType: "order_placed",
      userId: session.user.id,
      metadata: { orderId, shopId: shop.id, totalAmount },
      createdAt: now,
    });

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
      { id: inserted.id, orderNumber: inserted.orderNumber, totalAmount },
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

    // Check current availability for each item
    const menuItemIds = items.map((i) => i.menuItemId);
    const availabilityRows = await db
      .select({ id: menuItems.id, isAvailable: menuItems.isAvailable })
      .from(menuItems)
      .where(inArray(menuItems.id, menuItemIds));

    const availMap = new Map(availabilityRows.map((r) => [r.id, r.isAvailable]));

    return c.json({
      ...lastOrder,
      items: items.map((i) => ({
        ...i,
        isAvailable: availMap.get(i.menuItemId) ?? false,
      })),
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
      const start = new Date(`${dateParam}T00:00:00`);
      const end = new Date(`${dateParam}T23:59:59.999`);
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
        totalAmount: orders.totalAmount,
        note: orders.note,
        isDone: orders.isDone,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
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
    if (existing.isCancelled) return c.json({ error: "Order already cancelled" }, 409);

    await db.execute(
      sql`UPDATE "orders" SET "is_cancelled" = true, "cancelled_at" = NOW() WHERE "id" = ${id}`,
    );

    return c.json({ isCancelled: true });
  });
