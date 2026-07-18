// Pure order/payment allocation used by the Khata reconcile (see reconcile.ts).
// Given the shop's untied ("Record Payment") pool, the ids of orders already
// settled individually via the per-order "Paid" button (tied), and its accepted
// orders oldest-first, decide which orders the pool covers (oldest-first,
// cumulative) and which it doesn't. Extracted as a pure function so the money
// logic is unit-tested independently of the database.
export function allocatePayments(
  pool: number,
  tiedIds: ReadonlySet<string | null>,
  ordersOldestFirst: readonly { id: string; amount: number }[],
): { toPay: string[]; toUnpay: string[] } {
  let cumulative = 0;
  const toPay: string[] = [];
  const toUnpay: string[] = [];
  for (const o of ordersOldestFirst) {
    if (tiedIds.has(o.id)) continue; // settled individually via the per-order button
    cumulative += o.amount;
    (cumulative <= pool ? toPay : toUnpay).push(o.id);
  }
  return { toPay, toUnpay };
}
