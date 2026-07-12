import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import { eq, and, desc, gte, lt, sql, inArray } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { orders, orderItems, shops, payments, user, analyticsEvents } from "@tamurfood/db/schema";
import { requireAdmin, type Variables } from "../lib/helpers";
import { orderEvents, type NewOrderEvent } from "../lib/order-events";

const paymentSchema = z.object({
  shopId: z.string().min(1),
  amount: z.number().int().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(300).optional(),
});

export const adminRouter = new Hono<{ Variables: Variables }>()
  // GET /orders — all orders with shopName (page, date, isDone)
  .get("/orders", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const page = Math.max(1, Number(c.req.query("page") ?? "1"));
    const dateParam = c.req.query("date");
    const isDoneParam = c.req.query("isDone");
    const pageSize = 30;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [];
    if (dateParam) {
      const start = new Date(`${dateParam}T00:00:00`);
      const end = new Date(`${dateParam}T23:59:59.999`);
      conditions.push(gte(orders.placedAt, start) as ReturnType<typeof eq>);
      conditions.push(lt(orders.placedAt, end) as ReturnType<typeof eq>);
    }
    if (isDoneParam !== undefined && isDoneParam !== "") {
      conditions.push(eq(orders.isDone, isDoneParam === "true") as ReturnType<typeof eq>);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where);

    const orderRows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        shopId: orders.shopId,
        shopName: shops.shopName,
        totalAmount: orders.totalAmount,
        note: orders.note,
        isDone: orders.isDone,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
        placedAt: orders.placedAt,
        doneAt: orders.doneAt,
      })
      .from(orders)
      .innerJoin(shops, eq(orders.shopId, shops.id))
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(pageSize)
      .offset(offset);

    if (orderRows.length === 0) {
      return c.json({ orders: [], total: count, page, pageSize });
    }

    const orderIds = orderRows.map((o) => o.id);
    const itemRows = await db
      .select({
        orderId: orderItems.orderId,
        itemName: orderItems.itemName,
        itemPrice: orderItems.itemPrice,
        quantity: orderItems.quantity,
        lineTotal: orderItems.lineTotal,
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
  // GET /orders/stream — SSE stream for new orders (kept as raw EventSource on client)
  .get("/orders/stream", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    return streamSSE(c, async (stream) => {
      const handler = async (data: NewOrderEvent) => {
        await stream.writeSSE({ event: "new_order", data: JSON.stringify(data) });
      };
      orderEvents.on("new_order", handler);
      stream.onAbort(() => { orderEvents.off("new_order", handler); });
      while (true) {
        await stream.sleep(30_000);
        await stream.writeSSE({ event: "ping", data: "" });
      }
    });
  })
  // PATCH /orders/:id/done — mark order as done (immutable), optionally record payment
  .patch(
    "/orders/:id/done",
    zValidator("json", z.object({ paid: z.boolean() })),
    async (c) => {
      const authErr = requireAdmin(c);
      if (authErr) return authErr;

      const session = c.get("session")!;
      const id = c.req.param("id");
      const { paid } = c.req.valid("json");

      const [existing] = await db
        .select({
          isDone: orders.isDone,
          shopId: orders.shopId,
          placedAt: orders.placedAt,
          totalAmount: orders.totalAmount,
          orderNumber: orders.orderNumber,
        })
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!existing) {
        return c.json({ error: "Not found" }, 404);
      }
      if (existing.isDone) {
        return c.json({ error: "Order already marked as done" }, 409);
      }

      const now = new Date();

      await db
        .update(orders)
        .set({ isDone: true, doneAt: now })
        .where(eq(orders.id, id));

      if (paid) {
        await db.insert(payments).values({
          id: crypto.randomUUID(),
          shopId: existing.shopId,
          amount: existing.totalAmount,
          paymentDate: now.toISOString().slice(0, 10),
          note: `Order #${existing.orderNumber}`,
          recordedBy: session.user.id,
          createdAt: now,
        });
      }

      await db.insert(analyticsEvents).values({
        id: crypto.randomUUID(),
        eventType: "order_done",
        userId: session.user.id,
        metadata: {
          orderId: id,
          shopId: existing.shopId,
          paid,
          fulfillmentMs: now.getTime() - new Date(existing.placedAt).getTime(),
        },
        createdAt: now,
      });

      return c.json({ isDone: true, paid });
    },
  )
  // GET /analytics — today/week/month stats + top 5 shops
  .get("/analytics", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayStats, weekStats, monthStats] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
        })
        .from(orders)
        .where(gte(orders.placedAt, todayStart)),
      db
        .select({
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
        })
        .from(orders)
        .where(gte(orders.placedAt, weekStart)),
      db
        .select({
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
        })
        .from(orders)
        .where(gte(orders.placedAt, monthStart)),
    ]);

    const topShops = await db
      .select({
        shopId: orders.shopId,
        shopName: shops.shopName,
        revenue: sql<number>`sum(${orders.totalAmount})::int`,
        orderCount: sql<number>`count(*)::int`,
      })
      .from(orders)
      .innerJoin(shops, eq(orders.shopId, shops.id))
      .where(gte(orders.placedAt, monthStart))
      .groupBy(orders.shopId, shops.shopName)
      .orderBy(desc(sql`sum(${orders.totalAmount})`))
      .limit(5);

    return c.json({
      today: todayStats[0],
      week: weekStats[0],
      month: monthStats[0],
      topShops,
    });
  })
  // GET /payments — list payments with shopName + recorder name
  .get("/payments", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const rows = await db
      .select({
        id: payments.id,
        shopId: payments.shopId,
        shopName: shops.shopName,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        note: payments.note,
        recordedByName: user.name,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(shops, eq(payments.shopId, shops.id))
      .innerJoin(user, eq(payments.recordedBy, user.id))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

    return c.json(rows);
  })
  // POST /payments — record a payment
  .post("/payments", zValidator("json", paymentSchema), async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const body = c.req.valid("json");

    const [shop] = await db
      .select({ id: shops.id })
      .from(shops)
      .where(eq(shops.id, body.shopId))
      .limit(1);

    if (!shop) {
      return c.json({ error: "Shop not found" }, 404);
    }

    const [inserted] = await db
      .insert(payments)
      .values({
        id: crypto.randomUUID(),
        shopId: body.shopId,
        amount: body.amount,
        paymentDate: body.paymentDate,
        note: body.note ?? null,
        recordedBy: session.user.id,
        createdAt: new Date(),
      })
      .returning({ id: payments.id });

    return c.json({ id: inserted.id }, 201);
  })
  // DELETE /payments/:id — delete a payment
  .delete("/payments/:id", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const id = c.req.param("id");
    const [existing] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Not found" }, 404);
    }

    await db.delete(payments).where(eq(payments.id, id));
    return c.json({ success: true });
  })
  // GET /shops/:shopId/orders — full order history for one shop (admin view)
  .get("/shops/:shopId/orders", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const shopId = c.req.param("shopId");
    const [shop] = await db
      .select({ id: shops.id, shopName: shops.shopName })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    if (!shop) {
      return c.json({ error: "Shop not found" }, 404);
    }

    const orderRows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        shopId: orders.shopId,
        shopName: shops.shopName,
        totalAmount: orders.totalAmount,
        note: orders.note,
        isDone: orders.isDone,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
        placedAt: orders.placedAt,
        doneAt: orders.doneAt,
      })
      .from(orders)
      .innerJoin(shops, eq(orders.shopId, shops.id))
      .where(eq(orders.shopId, shopId))
      .orderBy(desc(orders.placedAt))
      .limit(50);

    if (orderRows.length === 0) {
      return c.json({ shopName: shop.shopName, orders: [] });
    }

    const orderIds = orderRows.map((o) => o.id);
    const itemRows = await db
      .select({
        orderId: orderItems.orderId,
        itemName: orderItems.itemName,
        quantity: orderItems.quantity,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
      itemsByOrder.get(item.orderId)!.push(item);
    }

    return c.json({
      shopName: shop.shopName,
      orders: orderRows.map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] })),
    });
  })
  // PATCH /orders/:id/cancel — admin cancels any pending order
  .patch("/orders/:id/cancel", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const id = c.req.param("id");
    const [existing] = await db
      .select({
        isDone: orders.isDone,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
      })
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.isDone) return c.json({ error: "Order already done" }, 409);
    if (existing.isCancelled) return c.json({ error: "Order already cancelled" }, 409);

    await db.execute(
      sql`UPDATE "orders" SET "is_cancelled" = true, "cancelled_at" = NOW() WHERE "id" = ${id}`,
    );

    return c.json({ isCancelled: true });
  });

