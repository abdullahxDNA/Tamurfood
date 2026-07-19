import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import { eq, and, gte, lt, desc, sql, inArray } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { orders, orderItems, payments, shops } from "@tamurfood/db/schema";
import {
  requireAdmin,
  requireSession,
  getShopForUser,
  type Variables,
} from "../lib/helpers";
import { dhakaDateStartUTC, dhakaDateString } from "../lib/time";
import { reconcileCarriedOverOrders } from "../lib/reconcile";

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

      // Reconcile carried-over dues on open, so old orders that are already
      // covered by payments show as paid without waiting for the next payment.
      await reconcileCarriedOverOrders(shopId);

      // Parse month param (default current month, in Dhaka time — otherwise
      // early-morning Dhaka would still show the previous month for ~6 hours).
      const monthParam = c.req.valid("query").month; // YYYY-MM
      const month = monthParam ?? dhakaDateString().slice(0, 7);
      const [year, mon] = month.split("-").map(Number);
      // Calendar-date strings for payment_date comparisons (payment_date is
      // stored as the Dhaka calendar date, so compare against plain YYYY-MM-DD).
      const monthStartStr = `${month}-01`;
      const nextMonthStr =
        mon === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
      // UTC instants of the Dhaka month boundaries, for placed_at (timestamp)
      // comparisons — so an order placed 00:00–06:00 Dhaka on the 1st counts in
      // the right month, consistent with the rest of the app.
      const monthStart = dhakaDateStartUTC(monthStartStr);
      const monthEnd = dhakaDateStartUTC(nextMonthStr);

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
                sql`${monthStartStr}::date`,
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
            dailyNumber: orders.dailyNumber,
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
            // The order this payment settled (NULL for lump-sum payments).
            paidOrderNumber: orders.orderNumber,
            paidDailyNumber: orders.dailyNumber,
          })
          .from(payments)
          .leftJoin(orders, eq(payments.orderId, orders.id))
          .where(
            and(
              eq(payments.shopId, shopId),
              gte(
                sql`${payments.paymentDate}::date`,
                sql`${monthStartStr}::date`,
              ),
              lt(
                sql`${payments.paymentDate}::date`,
                sql`${nextMonthStr}::date`,
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
        dailyNumber?: number | null;
        note: string | null;
        // When a payment was recorded (has a time-of-day, unlike the date-only
        // paymentDate) — lets the shop ledger show the payment's time.
        createdAt?: string;
        // For a payment made against a specific order: that order's numbers, so
        // the ledger can show "Paid — Order #5 · Ref #1042".
        paidOrderNumber?: number | null;
        paidDailyNumber?: number | null;
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
          dailyNumber: o.dailyNumber,
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
          paidOrderNumber: p.paidOrderNumber,
          paidDailyNumber: p.paidDailyNumber,
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
            dailyNumber: e.dailyNumber,
            note: e.note,
            createdAt: e.createdAt,
            paidOrderNumber: e.paidOrderNumber,
            paidDailyNumber: e.paidDailyNumber,
            balance: running,
          };
        })
        .reverse();

      // All the shop's still-unpaid accepted orders (any date), newest first —
      // so they can be settled from one place regardless of when they were made.
      const unpaidRows = await db
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

      // Attach line items so the shop can expand an unpaid order to see what's
      // in it.
      const unpaidItems =
        unpaidRows.length > 0
          ? await db
              .select({
                orderId: orderItems.orderId,
                itemName: orderItems.itemName,
                quantity: orderItems.quantity,
                lineTotal: orderItems.lineTotal,
              })
              .from(orderItems)
              .where(
                inArray(
                  orderItems.orderId,
                  unpaidRows.map((o) => o.id),
                ),
              )
          : [];
      const itemsByOrder = new Map<string, typeof unpaidItems>();
      for (const it of unpaidItems) {
        if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, []);
        itemsByOrder.get(it.orderId)!.push(it);
      }
      const unpaidOrders = unpaidRows.map((o) => ({
        ...o,
        items: itemsByOrder.get(o.id) ?? [],
      }));

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
