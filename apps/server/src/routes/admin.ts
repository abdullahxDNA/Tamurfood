import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import { eq, and, desc, gte, lt, sql, inArray } from "drizzle-orm";
import { db } from "@tamurfood/db";
import {
  orders,
  orderItems,
  shops,
  payments,
  user,
  session as sessionTable,
  account,
  analyticsEvents,
  pendingMenuChanges,
  menuItems,
} from "@tamurfood/db/schema";
import { auth } from "../auth";
import { requireAdmin, requireModerator, type Variables } from "../lib/helpers";
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
    const authErr = requireModerator(c);
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
      conditions.push(
        eq(orders.isDone, isDoneParam === "true") as ReturnType<typeof eq>,
      );
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
        dailyNumber: orders.dailyNumber,
        shopId: orders.shopId,
        shopName: shops.shopName,
        totalAmount: orders.totalAmount,
        note: orders.note,
        isDone: orders.isDone,
        isPaid: sql<boolean>`"orders"."is_paid"`,
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
    const authErr = requireModerator(c);
    if (authErr) return authErr;

    return streamSSE(c, async (stream) => {
      const handler = async (data: NewOrderEvent) => {
        await stream.writeSSE({
          event: "new_order",
          data: JSON.stringify(data),
        });
      };
      orderEvents.on("new_order", handler);
      stream.onAbort(() => {
        orderEvents.off("new_order", handler);
      });
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
      const authErr = requireModerator(c);
      if (authErr) return authErr;

      const session = c.get("session")!;
      const id = c.req.param("id");
      const { paid } = c.req.valid("json");

      const [existing] = await db
        .select({
          isDone: orders.isDone,
          isCancelled: sql<boolean>`"orders"."is_cancelled"`,
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
      if (existing.isCancelled) {
        return c.json(
          { error: "Order was cancelled and can't be accepted" },
          409,
        );
      }
      if (existing.isDone) {
        return c.json({ error: "Order already marked as done" }, 409);
      }

      const now = new Date();

      await db
        .update(orders)
        .set({ isDone: true, isPaid: paid, doneAt: now })
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
  // PATCH /orders/:id/paid — mark an accepted-but-unpaid order as paid,
  // recording a payment (for when a shop pays after delivery)
  .patch("/orders/:id/paid", async (c) => {
    const authErr = requireModerator(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const id = c.req.param("id");

    const [existing] = await db
      .select({
        isDone: orders.isDone,
        isPaid: sql<boolean>`"orders"."is_paid"`,
        isCancelled: sql<boolean>`"orders"."is_cancelled"`,
        shopId: orders.shopId,
        totalAmount: orders.totalAmount,
        orderNumber: orders.orderNumber,
      })
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.isCancelled)
      return c.json({ error: "Order was cancelled" }, 409);
    if (!existing.isDone)
      return c.json({ error: "Accept the order first" }, 409);
    if (existing.isPaid)
      return c.json({ error: "Order already marked paid" }, 409);

    const now = new Date();
    await db.update(orders).set({ isPaid: true }).where(eq(orders.id, id));
    await db.insert(payments).values({
      id: crypto.randomUUID(),
      shopId: existing.shopId,
      amount: existing.totalAmount,
      paymentDate: now.toISOString().slice(0, 10),
      note: `Order #${existing.orderNumber}`,
      recordedBy: session.user.id,
      createdAt: now,
    });

    return c.json({ isPaid: true });
  })
  // GET /analytics — today/week/month stats + top 5 shops
  .get("/analytics", async (c) => {
    const authErr = requireModerator(c);
    if (authErr) return authErr;

    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
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
  // GET /analytics/range?from=YYYY-MM-DD&to=YYYY-MM-DD
  .get(
    "/analytics/range",
    zValidator(
      "query",
      z.object({ from: z.string().date(), to: z.string().date() }),
    ),
    async (c) => {
      const authErr = requireModerator(c);
      if (authErr) return authErr;

      const { from, to } = c.req.valid("query");
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1); // inclusive end

      const [stats] = await db
        .select({
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.placedAt, fromDate),
            lt(orders.placedAt, toDate),
            eq(orders.isCancelled, false),
          ),
        );

      const topShops = await db
        .select({
          shopName: shops.shopName,
          revenue: sql<number>`sum(${orders.totalAmount})::int`,
          orderCount: sql<number>`count(*)::int`,
        })
        .from(orders)
        .innerJoin(shops, eq(orders.shopId, shops.id))
        .where(
          and(
            gte(orders.placedAt, fromDate),
            lt(orders.placedAt, toDate),
            eq(orders.isCancelled, false),
          ),
        )
        .groupBy(shops.shopName)
        .orderBy(desc(sql`sum(${orders.totalAmount})`))
        .limit(5);

      return c.json({ from, to, ...stats, topShops });
    },
  )
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
  // GET /collections?date=YYYY-MM-DD — how much each staff/admin collected that
  // day (by when it was recorded), so cash can be reconciled against staff.
  .get(
    "/collections",
    zValidator("query", z.object({ date: z.string().date() })),
    async (c) => {
      const authErr = requireAdmin(c);
      if (authErr) return authErr;

      const { date } = c.req.valid("query");
      const rows = await db
        .select({
          staffId: payments.recordedBy,
          staffName: user.name,
          total: sql<number>`sum(${payments.amount})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(payments)
        .innerJoin(user, eq(payments.recordedBy, user.id))
        .where(sql`${payments.createdAt}::date = ${date}::date`)
        .groupBy(payments.recordedBy, user.name)
        .orderBy(desc(sql`sum(${payments.amount})`));

      return c.json(rows);
    },
  )
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
  // GET /shops/:shopId/orders — full order history for one shop (admin/moderator view)
  .get("/shops/:shopId/orders", async (c) => {
    const authErr = requireModerator(c);
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
        dailyNumber: orders.dailyNumber,
        shopId: orders.shopId,
        shopName: shops.shopName,
        totalAmount: orders.totalAmount,
        note: orders.note,
        isDone: orders.isDone,
        isPaid: sql<boolean>`"orders"."is_paid"`,
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
      orders: orderRows.map((o) => ({
        ...o,
        items: itemsByOrder.get(o.id) ?? [],
      })),
    });
  })
  // PATCH /orders/:id/cancel — cancel any pending order, with an optional reason
  // the shop sees in their order history (e.g. "Sorry, stock out")
  .patch(
    "/orders/:id/cancel",
    zValidator(
      "json",
      z.object({ reason: z.string().max(300).optional() }).optional(),
    ),
    async (c) => {
      const authErr = requireModerator(c);
      if (authErr) return authErr;

      const id = c.req.param("id");
      const reason = c.req.valid("json")?.reason ?? null;

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
      if (existing.isCancelled)
        return c.json({ error: "Order already cancelled" }, 409);

      await db
        .update(orders)
        .set({
          isCancelled: true,
          cancelReason: reason,
          cancelledAt: new Date(),
        })
        .where(eq(orders.id, id));

      return c.json({ isCancelled: true });
    },
  )
  // GET /pending-changes/count — badge count for nav (moderator+admin)
  .get("/pending-changes/count", async (c) => {
    const authErr = requireModerator(c);
    if (authErr) return authErr;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pendingMenuChanges)
      .where(eq(pendingMenuChanges.status, "pending"));

    return c.json({ count });
  })
  // GET /pending-changes — list all pending changes with proposer name (admin only)
  .get("/pending-changes", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const rows = await db
      .select({
        id: pendingMenuChanges.id,
        type: pendingMenuChanges.type,
        proposedBy: pendingMenuChanges.proposedBy,
        proposedByName: user.name,
        menuItemId: pendingMenuChanges.menuItemId,
        proposedData: pendingMenuChanges.proposedData,
        status: pendingMenuChanges.status,
        createdAt: pendingMenuChanges.createdAt,
        // Current values of the item being edited/deleted, so the admin can
        // see before → after. Null for a create (no existing item).
        currentName: menuItems.name,
        currentPrice: menuItems.price,
        currentCategory: menuItems.category,
        currentImageUrl: menuItems.imageUrl,
      })
      .from(pendingMenuChanges)
      .innerJoin(user, eq(pendingMenuChanges.proposedBy, user.id))
      .leftJoin(menuItems, eq(pendingMenuChanges.menuItemId, menuItems.id))
      .where(eq(pendingMenuChanges.status, "pending"))
      .orderBy(desc(pendingMenuChanges.createdAt));

    return c.json(rows);
  })
  // PATCH /pending-changes/:id/approve — apply the change (admin only)
  .patch("/pending-changes/:id/approve", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const session = c.get("session")!;
    const id = c.req.param("id");

    const [change] = await db
      .select()
      .from(pendingMenuChanges)
      .where(
        and(
          eq(pendingMenuChanges.id, id),
          eq(pendingMenuChanges.status, "pending"),
        ),
      )
      .limit(1);

    if (!change) return c.json({ error: "Not found or already reviewed" }, 404);

    const now = new Date();

    if (change.type === "create") {
      const data = change.proposedData as {
        name: string;
        price: number;
        category: string;
        imageUrl?: string | null;
        sortOrder?: number;
      };
      await db.insert(menuItems).values({
        id: crypto.randomUUID(),
        name: data.name,
        price: data.price,
        category: data.category,
        imageUrl: data.imageUrl ?? null,
        sortOrder: data.sortOrder ?? 0,
        isAvailable: true,
        createdAt: now,
      });
    } else if (change.type === "update" && change.menuItemId) {
      const data = change.proposedData as Partial<{
        name: string;
        price: number;
        category: string;
        imageUrl: string | null;
        sortOrder: number;
      }>;
      await db
        .update(menuItems)
        .set(data)
        .where(eq(menuItems.id, change.menuItemId));
    } else if (change.type === "delete" && change.menuItemId) {
      await db.delete(menuItems).where(eq(menuItems.id, change.menuItemId));
    }

    await db
      .update(pendingMenuChanges)
      .set({ status: "approved", reviewedAt: now, reviewedBy: session.user.id })
      .where(eq(pendingMenuChanges.id, id));

    return c.json({ success: true });
  })
  // PATCH /pending-changes/:id/reject — reject with optional note (admin only)
  .patch(
    "/pending-changes/:id/reject",
    zValidator("json", z.object({ note: z.string().max(300).optional() })),
    async (c) => {
      const authErr = requireAdmin(c);
      if (authErr) return authErr;

      const session = c.get("session")!;
      const id = c.req.param("id");
      const { note } = c.req.valid("json");

      const [change] = await db
        .select({ id: pendingMenuChanges.id })
        .from(pendingMenuChanges)
        .where(
          and(
            eq(pendingMenuChanges.id, id),
            eq(pendingMenuChanges.status, "pending"),
          ),
        )
        .limit(1);

      if (!change)
        return c.json({ error: "Not found or already reviewed" }, 404);

      await db
        .update(pendingMenuChanges)
        .set({
          status: "rejected",
          reviewNote: note ?? null,
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
        })
        .where(eq(pendingMenuChanges.id, id));

      return c.json({ success: true });
    },
  )
  // GET /moderators — list all moderator accounts (admin only)
  .get("/moderators", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.role, "moderator"))
      .orderBy(user.createdAt);

    return c.json(rows);
  })
  // POST /moderators — create a moderator account (admin only)
  .post(
    "/moderators",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        phone: z.string().min(5).max(20),
        email: z.string().email().optional().nullable(),
        password: z.string().min(6),
      }),
    ),
    async (c) => {
      const authErr = requireAdmin(c);
      if (authErr) return authErr;

      const body = c.req.valid("json");

      const existing = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.phoneNumber, body.phone))
        .limit(1);

      if (existing.length > 0) {
        return c.json({ error: "Phone number already in use" }, 409);
      }

      const email = body.email ?? `mod-${body.phone}@tamurfood.local`;

      const ctx = await auth.$context;
      const newUser = await ctx.internalAdapter.createUser({
        email,
        name: body.name,
        role: "moderator",
        phoneNumber: body.phone,
        isActive: true,
      });

      if (!newUser) return c.json({ error: "Failed to create user" }, 500);

      const hash = await ctx.password.hash(body.password);
      await ctx.internalAdapter.linkAccount({
        accountId: newUser.id,
        providerId: "credential",
        password: hash,
        userId: newUser.id,
      });

      return c.json({ id: newUser.id }, 201);
    },
  )
  // PATCH /moderators/:id/status — toggle moderator isActive (admin only)
  .patch("/moderators/:id/status", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const id = c.req.param("id");

    const [mod] = await db
      .select({ isActive: user.isActive, role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!mod || mod.role !== "moderator") {
      return c.json({ error: "Moderator not found" }, 404);
    }

    const newStatus = !mod.isActive;
    await db
      .update(user)
      .set({ isActive: newStatus, updatedAt: new Date() })
      .where(eq(user.id, id));

    if (!newStatus) {
      await db.delete(sessionTable).where(eq(sessionTable.userId, id));
    }

    return c.json({ isActive: newStatus });
  })
  // POST /moderators/:id/reset-password — admin resets moderator password (admin only)
  .post(
    "/moderators/:id/reset-password",
    zValidator("json", z.object({ newPassword: z.string().min(6) })),
    async (c) => {
      const authErr = requireAdmin(c);
      if (authErr) return authErr;

      const id = c.req.param("id");
      const { newPassword } = c.req.valid("json");

      const [mod] = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

      if (!mod || mod.role !== "moderator") {
        return c.json({ error: "Moderator not found" }, 404);
      }

      const ctx = await auth.$context;
      const hash = await ctx.password.hash(newPassword);

      await db
        .update(account)
        .set({ password: hash, updatedAt: new Date() })
        .where(eq(account.userId, id));

      await db.delete(sessionTable).where(eq(sessionTable.userId, id));

      return c.json({ success: true });
    },
  );
