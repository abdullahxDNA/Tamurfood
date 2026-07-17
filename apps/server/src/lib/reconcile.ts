import { and, eq, lt, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { orders, payments } from "@tamurfood/db/schema";
import { startOfDhakaDayUTC } from "./time";

// Reconcile a shop's carried-over dues against its cumulative "Record Payment"
// (untied) pool. Marks the oldest carried-over orders (accepted, placed before
// today in Dhaka, and NOT settled individually via the per-order "Paid" button)
// paid while their running total is covered by the pool — and un-marks them if
// the pool no longer covers them (e.g. a payment was deleted).
//
// Uses the CUMULATIVE pool, so several small payments add up to clear an order.
// Idempotent — safe to call on payment insert/delete AND when the Khata is
// opened, so orders clear on their own once they roll over to a previous day.
export async function reconcileCarriedOverOrders(shopId: string) {
  const [{ pool }] = await db
    .select({ pool: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
    .from(payments)
    .where(and(eq(payments.shopId, shopId), isNull(payments.orderId)));

  const tied = await db
    .select({ orderId: payments.orderId })
    .from(payments)
    .where(and(eq(payments.shopId, shopId), isNotNull(payments.orderId)));
  const tiedIds = new Set(tied.map((t) => t.orderId));

  const oldOrders = await db
    .select({ id: orders.id, amount: orders.totalAmount })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shopId),
        eq(orders.isDone, true),
        eq(orders.isCancelled, false),
        lt(orders.placedAt, startOfDhakaDayUTC()),
      ),
    )
    .orderBy(orders.placedAt);

  let cumulative = 0;
  const toPay: string[] = [];
  const toUnpay: string[] = [];
  for (const o of oldOrders) {
    if (tiedIds.has(o.id)) continue; // settled individually via the per-order button
    cumulative += o.amount;
    (cumulative <= pool ? toPay : toUnpay).push(o.id);
  }
  if (toPay.length > 0) {
    await db
      .update(orders)
      .set({ isPaid: true })
      .where(inArray(orders.id, toPay));
  }
  if (toUnpay.length > 0) {
    await db
      .update(orders)
      .set({ isPaid: false })
      .where(inArray(orders.id, toUnpay));
  }
}
