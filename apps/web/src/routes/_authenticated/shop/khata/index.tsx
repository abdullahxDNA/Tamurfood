import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { OrderRef } from "@/components/order-ref";

export const Route = createFileRoute("/_authenticated/shop/khata/")({
  component: ShopKhataPage,
});

// Must match the key the shop layout writes to (see shop.tsx). Holds ledger-row
// IDs (order or payment IDs) that changed while the shop was away from Khata.
const NEW_KHATA_KEY = "shop-new-khata";
// How long a "NEW" marker lingers after the shop sees it, then clears.
const NEW_MARKER_MS = 10000;

// ─── Types ───────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  type: "order" | "payment";
  date: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  orderNumber?: number;
  dailyNumber?: number | null;
  note: string | null;
  createdAt?: string | null;
}

interface UnpaidOrder {
  id: string;
  orderNumber: number;
  dailyNumber: number | null;
  amount: number;
  placedAt: string;
  items: { itemName: string; quantity: number; lineTotal: number }[];
}

interface ShopLedger {
  shopId: string;
  shopName: string;
  month: string;
  outstandingBalance: number;
  openingBalance: number;
  monthOrdered: number;
  monthPaid: number;
  entries: LedgerEntry[];
  unpaidOrders: UnpaidOrder[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-BD", {
    month: "long",
    year: "numeric",
  });
}

// When a transaction happened. Orders carry a full timestamp. Payments have a
// date-only business date plus a recorded-at time (createdAt) — show the date
// from the business date and append the recorded time.
function fmtEntryWhen(entry: LedgerEntry) {
  if (entry.type === "order") {
    return new Date(entry.date).toLocaleString("en-BD", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const datePart = new Date(entry.date).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (entry.createdAt) {
    const timePart = new Date(entry.createdAt).toLocaleTimeString("en-BD", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart}, ${timePart}`;
  }
  return datePart;
}

// ─── Component ───────────────────────────────────────────────────────────────

// Chevron that points right when closed and down when open.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ShopKhataPage() {
  const [month, setMonth] = useState(currentMonth);
  const [unpaidOpen, setUnpaidOpen] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  function toggleOrder(id: string) {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const cur = currentMonth();

  const { data: myShop } = useQuery({
    queryKey: ["shop/me"],
    queryFn: async () => {
      const res = await api.api.v1.shops.me.$get();
      if (!res.ok) throw new Error("Failed to fetch shop info");
      return res.json() as Promise<{ shopId: string; shopName: string }>;
    },
  });

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["khata/ledger/me", myShop?.shopId, month],
    queryFn: async () => {
      const res = await api.api.v1.khata[":shopId"].$get({
        param: { shopId: myShop!.shopId },
        query: { month },
      });
      return res.json() as Promise<ShopLedger>;
    },
    enabled: !!myShop,
  });

  // Ledger rows that changed recently get a "NEW" marker, lingering a few
  // seconds after the shop sees them (on open, or live while on this page).
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const markNew = useCallback((id: string) => {
    setHighlightedIds((prev) => new Set(prev).add(id));
    const timers = timersRef.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.set(
      id,
      setTimeout(() => {
        setHighlightedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        timers.delete(id);
      }, NEW_MARKER_MS),
    );
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // On open, flash rows that changed while the shop was on another tab.
  useEffect(() => {
    let ids: string[] = [];
    try {
      const raw = localStorage.getItem(NEW_KHATA_KEY);
      if (!raw) return;
      localStorage.removeItem(NEW_KHATA_KEY);
      ids = JSON.parse(raw) as string[];
    } catch {
      return;
    }
    const t = setTimeout(() => {
      for (const id of ids) markNew(id);
    }, 0);
    return () => clearTimeout(t);
  }, [markNew]);

  // Live: when staff accept an order or record a payment for this shop, refetch
  // the ledger and flash the new row. Accepted order → row id is the order id;
  // payment → row id is the payment id.
  useEffect(() => {
    const source = new EventSource("/api/v1/orders/stream");
    const refetchAndMark = (id?: string) => {
      queryClient.invalidateQueries({ queryKey: ["khata/ledger/me"] });
      if (id) markNew(id);
    };
    source.addEventListener("order_status", (e) => {
      try {
        const p = JSON.parse((e as MessageEvent).data) as {
          status?: string;
          orderId?: string;
        };
        if (p.status === "accepted") refetchAndMark(p.orderId);
      } catch {
        /* ignore */
      }
    });
    source.addEventListener("payment_recorded", (e) => {
      try {
        const { paymentId } = JSON.parse((e as MessageEvent).data) as {
          paymentId?: string;
        };
        refetchAndMark(paymentId);
      } catch {
        /* ignore */
      }
    });
    return () => source.close();
  }, [queryClient, markNew]);

  const owe = data?.outstandingBalance ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Khata</h1>

      {(!myShop || isLoading) && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {/* Balance hero — the number the shop cares about most (all-time). */}
      {data && (
        <div
          className={`rounded-xl border p-5 text-center ${
            owe > 0
              ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
              : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Your balance
          </p>
          <p
            className={`mt-1 text-4xl font-bold ${
              owe > 0
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}
          >
            ৳{Math.abs(owe).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {owe > 0
              ? "you owe the bakery"
              : owe < 0
                ? "overpaid — credit in your favour"
                : "all settled ✓"}
          </p>
        </div>
      )}

      {/* Unpaid orders (all-time) — collapsible; tap a row to see its items */}
      {data && data.unpaidOrders.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setUnpaidOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <Chevron open={unpaidOpen} />
            <h2 className="text-sm font-semibold">Unpaid orders</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {data.unpaidOrders.length} order
              {data.unpaidOrders.length === 1 ? "" : "s"} · ৳
              {data.unpaidOrders
                .reduce((s, o) => s + o.amount, 0)
                .toLocaleString()}
            </span>
          </button>

          {unpaidOpen && (
            <div className="space-y-2">
              {data.unpaidOrders.map((o) => {
                const expanded = expandedOrders.has(o.id);
                return (
                  <div
                    key={o.id}
                    className="overflow-hidden rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"
                  >
                    <button
                      type="button"
                      onClick={() => toggleOrder(o.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Chevron open={expanded} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <OrderRef
                              className="text-sm"
                              withLabel
                              dailyNumber={o.dailyNumber}
                              orderNumber={o.orderNumber}
                            />
                            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                              Unpaid
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(o.placedAt).toLocaleDateString("en-BD", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        ৳{o.amount.toLocaleString()}
                      </span>
                    </button>

                    {expanded && (
                      <div className="space-y-1 border-t border-amber-200 px-4 py-2.5 dark:border-amber-900">
                        {o.items.map((it, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {it.quantity}× {it.itemName}
                            </span>
                            <span className="tabular-nums">
                              ৳{it.lineTotal.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-full border hover:bg-accent"
          onClick={() => setMonth(prevMonth(month))}
        >
          ‹ Prev
        </button>
        <span className="text-sm font-semibold">{fmtMonthLabel(month)}</span>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-full border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setMonth(nextMonth(month))}
          disabled={month >= cur}
        >
          Next ›
        </button>
      </div>

      {/* This month at a glance */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Ordered this month</p>
            <p className="mt-0.5 text-xl font-bold">
              ৳{data.monthOrdered.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Paid this month</p>
            <p className="mt-0.5 text-xl font-bold text-green-600 dark:text-green-400">
              ৳{data.monthPaid.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Transactions */}
      {data && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Transactions</h2>
            {data.openingBalance !== 0 && data.entries.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Opening: ৳{data.openingBalance.toLocaleString()}
              </span>
            )}
          </div>

          {data.entries.length === 0 && (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              No transactions this month.
            </p>
          )}

          {data.entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all ${
                highlightedIds.has(entry.id)
                  ? "ring-2 ring-primary bg-primary/5"
                  : ""
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${
                      entry.type === "order"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                        : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                    }`}
                  >
                    {entry.type === "order"
                      ? `Order #${entry.dailyNumber ?? entry.orderNumber}`
                      : "Payment received"}
                  </span>
                  {entry.type === "order" && entry.dailyNumber != null && (
                    <span className="text-[10px] text-muted-foreground">
                      Ref #{entry.orderNumber}
                    </span>
                  )}
                  {highlightedIds.has(entry.id) && (
                    <span className="animate-pulse rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtEntryWhen(entry)}
                </p>
                {entry.note && (
                  <p className="text-xs text-muted-foreground italic">
                    "{entry.note}"
                  </p>
                )}
              </div>
              <div className="text-right space-y-0.5">
                <p
                  className={`font-medium ${
                    entry.type === "order"
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {entry.type === "order"
                    ? `+৳${entry.debit}`
                    : `−৳${entry.credit}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  bal: ৳{entry.balance.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
