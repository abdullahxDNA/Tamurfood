import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { orders, payments } from "@tamurfood/db/schema";
import { allocatePayments } from "./allocate";

// Either the top-level db or an open transaction handle. Lets the caller run
// reconciliation inside the same transaction as the payment insert/delete so
// the two commit (or roll back) together.
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Reconcile a shop's unpaid orders against its cumulative "Record Payment"
// (untied) pool. Marks the shop's oldest unpaid orders (accepted, of ANY date,
// and NOT already settled individually via the per-order "Paid" button) paid
// while their running total is covered by the pool — and un-marks them if the
// pool no longer covers them (e.g. a payment was deleted).
//
// Uses the CUMULATIVE pool, so several small payments add up to clear an order,
// and a Record Payment settles the oldest dues first (today's orders included).
// Idempotent — safe to call on payment insert/delete AND when the Khata is
// opened, so orders clear on their own. Pass an open transaction as `executor`
// to run the reconciliation atomically with the payment write that triggered it.
export async function reconcileCarriedOverOrders(
  shopId: string,
  executor: DbOrTx = db,
) {
  const [{ pool }] = await executor
    .select({ pool: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
    .from(payments)
    .where(and(eq(payments.shopId, shopId), isNull(payments.orderId)));

  const tied = await executor
    .select({ orderId: payments.orderId })
    .from(payments)
    .where(and(eq(payments.shopId, shopId), isNotNull(payments.orderId)));
  const tiedIds = new Set(tied.map((t) => t.orderId));

  const candidateOrders = await executor
    .select({ id: orders.id, amount: orders.totalAmount })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shopId),
        eq(orders.isDone, true),
        eq(orders.isCancelled, false),
      ),
    )
    .orderBy(orders.placedAt);

  const { toPay, toUnpay } = allocatePayments(pool, tiedIds, candidateOrders);
  if (toPay.length > 0) {
    await executor
      .update(orders)
      .set({ isPaid: true })
      .where(inArray(orders.id, toPay));
  }
  if (toUnpay.length > 0) {
    await executor
      .update(orders)
      .set({ isPaid: false })
      .where(inArray(orders.id, toUnpay));
  }
}
