import { and, eq, lt } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { orders } from "@tamurfood/db/schema";
import { orderEvents, type OrderStatusEvent } from "./order-events";
import { startOfDhakaDayUTC } from "./time";

// End-of-day cleanup: orders a shop places but nobody accepts (or cancels) don't
// carry into the next day. Any order still pending from a *previous* Dhaka day is
// auto-cancelled with a clear reason the shop sees in its tracker + history. The
// sweep is idempotent and safe to run repeatedly — it never touches today's
// orders, so a valid order you haven't accepted yet is never cancelled.

const SWEEP_INTERVAL_MS = 30 * 60 * 1000; // re-check every 30 minutes
const CANCEL_REASON = "Not accepted — order closed for the day";

// Cancel every order still pending from before today (Dhaka time). Returns the
// number cancelled. Notifies each shop's live tracker so the change is instant.
export async function cancelStaleOrders(): Promise<number> {
  const cutoff = startOfDhakaDayUTC();

  const cancelled = await db
    .update(orders)
    .set({
      isCancelled: true,
      cancelReason: CANCEL_REASON,
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(orders.isDone, false),
        eq(orders.isCancelled, false),
        lt(orders.placedAt, cutoff),
      ),
    )
    .returning({ id: orders.id, shopId: orders.shopId });

  if (cancelled.length === 0) return 0;

  for (const o of cancelled) {
    orderEvents.emit("order_status", {
      orderId: o.id,
      shopId: o.shopId,
      status: "cancelled",
    } satisfies OrderStatusEvent);
  }

  console.log(
    `[stale-orders] Auto-cancelled ${cancelled.length} unaccepted order(s) from a previous day.`,
  );
  return cancelled.length;
}

// Run the sweep shortly after boot, then on a fixed interval. Because the sweep
// only ever acts on previous-day orders, running it every 30 min means the prior
// day's leftovers are cleared shortly after midnight (Dhaka).
export function startStaleOrderSweeper(): void {
  const run = () =>
    cancelStaleOrders().catch((err) =>
      console.error("[stale-orders] sweep failed:", err),
    );
  run();
  setInterval(run, SWEEP_INTERVAL_MS);
}
