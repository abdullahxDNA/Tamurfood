import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { OrderRef } from "@/components/order-ref";
import { useLang } from "@/lib/i18n";

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
  paidOrderNumber?: number | null;
  paidDailyNumber?: number | null;
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
  const { t } = useLang();
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-serif tracking-tight">
          {t("Khata Credit Ledger", "খাতা / বাকির হিসাব")}
        </h1>
        <span className="text-xs text-stone-400 font-mono">
          {t("Running Balance", "চলতি ব্যালেন্স")}
        </span>
      </div>

      {(!myShop || isLoading) && (
        <div className="rounded-2xl bg-stone-100 dark:bg-stone-900 p-8 text-center animate-pulse">
          <p className="text-stone-500 text-xs font-medium">
            {t("Loading ledger...", "হিসাব লোড হচ্ছে...")}
          </p>
        </div>
      )}

      {/* Balance hero — the number the shop cares about most (all-time). */}
      {data && (
        <div
          className={`rounded-3xl border p-6 text-center shadow-xs backdrop-blur-md ${
            owe > 0
              ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/20"
              : "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            {t("Total Outstanding Balance", "মোট বাকির পরিমাণ")}
          </p>
          <p
            className={`mt-1.5 text-4xl font-extrabold font-mono tracking-tight ${
              owe > 0
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            ৳{Math.abs(owe).toLocaleString()}
          </p>
          <p className="mt-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
            {owe > 0
              ? t(
                  "you owe the bakery for snacks delivered",
                  "ডেলিভারি হওয়া স্ন্যাকসের জন্য আপনি বেকারিকে বাকি আছেন",
                )
              : owe < 0
                ? t(
                    "overpaid — credit in your favour",
                    "বেশি পরিশোধ — আপনার পক্ষে জমা আছে",
                  )
                : t("all settled ✓", "সব পরিশোধিত ✓")}
          </p>
        </div>
      )}

      {/* Unpaid orders (all-time) */}
      {data && data.unpaidOrders.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-white dark:bg-stone-900 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setUnpaidOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-4.5 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
          >
            <Chevron open={unpaidOpen} />
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"
            />
            <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">
              {t("Unpaid Orders", "বকেয়া অর্ডার")}
            </h2>
            <span className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 font-mono">
              {t(
                `${data.unpaidOrders.length} order${data.unpaidOrders.length === 1 ? "" : "s"}`,
                `${data.unpaidOrders.length}টি অর্ডার`,
              )}{" "}
              · ৳
              {data.unpaidOrders
                .reduce((s, o) => s + o.amount, 0)
                .toLocaleString()}
            </span>
          </button>

          {unpaidOpen && (
            <div className="space-y-2 border-t border-red-500/20 p-3 bg-red-500/5 dark:bg-red-950/10">
              {data.unpaidOrders.map((o) => {
                const expanded = expandedOrders.has(o.id);
                return (
                  <div
                    key={o.id}
                    className="overflow-hidden rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900"
                  >
                    <button
                      type="button"
                      onClick={() => toggleOrder(o.id)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Chevron open={expanded} />
                        <div>
                          <OrderRef
                            className="text-xs font-bold font-mono"
                            withLabel
                            dailyNumber={o.dailyNumber}
                            orderNumber={o.orderNumber}
                          />
                          <p className="text-[10px] text-stone-400 font-mono">
                            {new Date(o.placedAt).toLocaleDateString("en-BD", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 font-mono">
                        ৳{o.amount.toLocaleString()}
                      </span>
                    </button>

                    {expanded && (
                      <div className="space-y-1 border-t border-stone-100 dark:border-stone-800 px-3.5 py-2 bg-stone-50/50 dark:bg-stone-950/50">
                        {o.items.map((it, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-stone-600 dark:text-stone-400">
                              {it.quantity}× {it.itemName}
                            </span>
                            <span className="tabular-nums font-semibold text-stone-800 dark:text-stone-200">
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
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
          onClick={() => setMonth(prevMonth(month))}
        >
          ‹ {t("Prev", "আগের")}
        </button>
        <span className="text-xs font-bold font-serif tracking-tight text-stone-900 dark:text-stone-100">
          {fmtMonthLabel(month)}
        </span>
        <button
          type="button"
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setMonth(nextMonth(month))}
          disabled={month >= cur}
        >
          {t("Next", "পরের")} ›
        </button>
      </div>

      {/* This month at a glance */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900 p-3.5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              {t("Ordered this month", "এ মাসে অর্ডার")}
            </p>
            <p className="mt-1 text-xl font-extrabold text-stone-900 dark:text-stone-100 font-mono">
              ৳{data.monthOrdered.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-3.5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {t("Paid this month", "এ মাসে পরিশোধ")}
            </p>
            <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              ৳{data.monthPaid.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Transactions */}
      {data && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              {t("Ledger Statement", "লেনদেনের বিবরণ")}
            </h2>
            {data.openingBalance !== 0 && data.entries.length > 0 && (
              <span className="text-xs font-medium text-stone-400 font-mono">
                {t("Opening", "প্রারম্ভিক")}: ৳
                {data.openingBalance.toLocaleString()}
              </span>
            )}
          </div>

          {data.entries.length === 0 && (
            <p className="rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 py-8 text-center text-xs text-stone-400">
              {t(
                `No transactions recorded for ${fmtMonthLabel(month)}.`,
                `${fmtMonthLabel(month)} মাসে কোনো লেনদেন নেই।`,
              )}
            </p>
          )}

          {data.entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900 px-4 py-3 text-xs transition-all shadow-xs ${
                highlightedIds.has(entry.id)
                  ? "ring-2 ring-amber-600/50 bg-amber-500/5"
                  : ""
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      entry.type === "order"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    }`}
                  >
                    {entry.type === "order"
                      ? t(
                          `Order #${entry.dailyNumber ?? entry.orderNumber}`,
                          `অর্ডার #${entry.dailyNumber ?? entry.orderNumber}`,
                        )
                      : entry.paidOrderNumber != null
                        ? t(
                            `Paid — Order #${entry.paidDailyNumber ?? entry.paidOrderNumber}`,
                            `পরিশোধ — অর্ডার #${entry.paidDailyNumber ?? entry.paidOrderNumber}`,
                          )
                        : t("Payment received", "পেমেন্ট গৃহীত")}
                  </span>
                  {entry.type === "order" && entry.dailyNumber != null && (
                    <span className="text-[10px] text-stone-400 font-mono">
                      Ref #{entry.orderNumber}
                    </span>
                  )}
                  {entry.type === "payment" &&
                    entry.paidOrderNumber != null &&
                    entry.paidDailyNumber != null && (
                      <span className="text-[10px] text-stone-400 font-mono">
                        Ref #{entry.paidOrderNumber}
                      </span>
                    )}
                  {highlightedIds.has(entry.id) && (
                    <span className="animate-pulse rounded-full bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 font-mono">
                  {fmtEntryWhen(entry)}
                </p>
                {entry.note && (
                  <p className="text-[11px] text-stone-500 italic">
                    "{entry.note}"
                  </p>
                )}
              </div>
              <div className="text-right space-y-0.5">
                <p
                  className={`font-bold font-mono text-xs ${
                    entry.type === "order"
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {entry.type === "order"
                    ? `+৳${entry.debit}`
                    : `−৳${entry.credit}`}
                </p>
                <p className="text-[10px] text-stone-400 font-mono">
                  {t("bal", "ব্যালেন্স")}: ৳{entry.balance.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
