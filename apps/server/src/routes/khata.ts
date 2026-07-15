import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { orders, payments, shops } from "@tamurfood/db/schema";
import {
  requireAdmin,
  requireSession,
  getShopForUser,
  type Variables,
} from "../lib/helpers";

export const khataRouter = new Hono<{ Variables: Variables }>()
  // GET /overview — all shops with all-time balance summary (admin only)
  .get("/overview", async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const allShops = await db
      .select({ id: shops.id, shopName: shops.shopName })
      .from(shops);

    if (allShops.length === 0) return c.json([]);

    const [orderTotals, paymentTotals] = await Promise.all([
      db
        .select({
          shopId: orders.shopId,
          total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
        })
        .from(orders)
        .where(and(eq(orders.isCancelled, false), eq(orders.isDone, true)))
        .groupBy(orders.shopId),
      db
        .select({
          shopId: payments.shopId,
          total: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
        })
        .from(payments)
        .groupBy(payments.shopId),
    ]);

    const ordersMap = new Map(orderTotals.map((r) => [r.shopId, r.total]));
    const paymentsMap = new Map(paymentTotals.map((r) => [r.shopId, r.total]));

    const result = allShops
      .map((s) => {
        const totalOrdered = ordersMap.get(s.id) ?? 0;
        const totalPaid = paymentsMap.get(s.id) ?? 0;
        return {
          shopId: s.id,
          shopName: s.shopName,
          totalOrdered,
          totalPaid,
          balance: totalOrdered - totalPaid,
        };
      })
      .sort((a, b) => b.balance - a.balance);

    return c.json(result);
  })
  // GET /:shopId — full ledger for one shop (admin or own shop)
  // Query: ?month=YYYY-MM (default: current month)
  .get(
    "/:shopId",
    zValidator("query", z.object({ month: z.string().optional() })),
    async (c) => {
      const authErr = requireSession(c);
      if (authErr) return authErr;

      const session = c.get("session")!;
      const shopId = c.req.param("shopId");

      // Auth: admin can view any shop; shop user can only view own shop
      if (session.user.role !== "admin") {
        const ownShop = await getShopForUser(session.user.id);
        if (!ownShop || ownShop.id !== shopId) {
          return c.json({ error: "Forbidden" }, 403);
        }
      }

      const [shop] = await db
        .select({ id: shops.id, shopName: shops.shopName })
        .from(shops)
        .where(eq(shops.id, shopId))
        .limit(1);

      if (!shop) return c.json({ error: "Shop not found" }, 404);

      // Parse month param (default current month)
      const monthParam = c.req.valid("query").month; // YYYY-MM
      const now = new Date();
      const month =
        monthParam ??
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [year, mon] = month.split("-").map(Number);
      const monthStart = new Date(year, mon - 1, 1);
      const monthEnd = new Date(year, mon, 1);

      // All-time totals (for outstanding balance)
      const [[allTimeOrders], [allTimePayments]] = await Promise.all([
        db
          .select({
            total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.shopId, shopId),
              eq(orders.isCancelled, false),
              eq(orders.isDone, true),
            ),
          ),
        db
          .select({
            total: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
          })
          .from(payments)
          .where(eq(payments.shopId, shopId)),
      ]);
      const outstandingBalance = allTimeOrders.total - allTimePayments.total;

      // Opening balance = balance at start of this month
      const [[prevOrders], [prevPayments]] = await Promise.all([
        db
          .select({
            total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.shopId, shopId),
              eq(orders.isCancelled, false),
              eq(orders.isDone, true),
              lt(orders.placedAt, monthStart),
            ),
          ),
        db
          .select({
            total: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
          })
          .from(payments)
          .where(
            and(
              eq(payments.shopId, shopId),
              lt(
                sql`${payments.paymentDate}::date`,
                sql`${monthStart.toISOString().slice(0, 10)}::date`,
              ),
            ),
          ),
      ]);
      const openingBalance = prevOrders.total - prevPayments.total;

      // Entries in this month
      const [monthOrders, monthPayments] = await Promise.all([
        db
          .select({
            id: orders.id,
            date: orders.placedAt,
            amount: orders.totalAmount,
            orderNumber: orders.orderNumber,
            note: orders.note,
          })
          .from(orders)
          .where(
            and(
              eq(orders.shopId, shopId),
              eq(orders.isCancelled, false),
              eq(orders.isDone, true),
              gte(orders.placedAt, monthStart),
              lt(orders.placedAt, monthEnd),
            ),
          ),
        db
          .select({
            id: payments.id,
            date: payments.paymentDate,
            amount: payments.amount,
            note: payments.note,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .where(
            and(
              eq(payments.shopId, shopId),
              gte(
                sql`${payments.paymentDate}::date`,
                sql`${monthStart.toISOString().slice(0, 10)}::date`,
              ),
              lt(
                sql`${payments.paymentDate}::date`,
                sql`${monthEnd.toISOString().slice(0, 10)}::date`,
              ),
            ),
          ),
      ]);

      // Month summary
      const monthOrdered = monthOrders.reduce((s, o) => s + o.amount, 0);
      const monthPaid = monthPayments.reduce((s, p) => s + p.amount, 0);

      // Merge and sort entries by date
      type Entry = {
        id: string;
        type: "order" | "payment";
        date: string;
        debit: number | null;
        credit: number | null;
        balance: number;
        orderNumber?: number;
        note: string | null;
        // When a payment was recorded (has a time-of-day, unlike the date-only
        // paymentDate) — lets the shop ledger show the payment's time.
        createdAt?: string;
      };

      // sortAt is the precise moment used to order the ledger — orders use their
      // placed time, payments use when they were recorded (paymentDate is only a
      // day, so it can't order same-day entries). It's internal: dropped before
      // the response is built.
      const merged: (Omit<Entry, "balance"> & { sortAt: number })[] = [
        ...monthOrders.map((o) => ({
          id: o.id,
          type: "order" as const,
          date: o.date.toISOString(),
          debit: o.amount,
          credit: null,
          orderNumber: o.orderNumber,
          note: o.note,
          sortAt: o.date.getTime(),
        })),
        ...monthPayments.map((p) => ({
          id: p.id,
          type: "payment" as const,
          date:
            typeof p.date === "string"
              ? p.date
              : (p.date as Date).toISOString().slice(0, 10),
          debit: null,
          credit: p.amount,
          note: p.note,
          createdAt: new Date(p.createdAt).toISOString(),
          sortAt: new Date(p.createdAt).getTime(),
        })),
      ].sort((a, b) => a.sortAt - b.sortAt);

      // Accumulate the running balance oldest → newest (each entry's balance is
      // the total up to and including it), then reverse so the newest
      // transaction shows first. The per-entry balance stays correct either way.
      let running = openingBalance;
      const entries: Entry[] = merged
        .map((e) => {
          running += (e.debit ?? 0) - (e.credit ?? 0);
          return {
            id: e.id,
            type: e.type,
            date: e.date,
            debit: e.debit,
            credit: e.credit,
            orderNumber: e.orderNumber,
            note: e.note,
            createdAt: e.createdAt,
            balance: running,
          };
        })
        .reverse();

      // All the shop's still-unpaid accepted orders (any date), newest first —
      // so they can be settled from one place regardless of when they were made.
      const unpaidOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          dailyNumber: orders.dailyNumber,
          amount: orders.totalAmount,
          placedAt: orders.placedAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.shopId, shopId),
            eq(orders.isDone, true),
            eq(orders.isPaid, false),
            eq(orders.isCancelled, false),
          ),
        )
        .orderBy(desc(orders.placedAt));

      return c.json({
        shopId: shop.id,
        shopName: shop.shopName,
        month,
        outstandingBalance,
        openingBalance,
        monthOrdered,
        monthPaid,
        entries,
        unpaidOrders,
      });
    },
  );
