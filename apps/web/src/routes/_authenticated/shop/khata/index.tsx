import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/shop/khata/")({
  component: ShopKhataPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  type: "order" | "payment";
  date: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  orderNumber?: number;
  note: string | null;
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

// When a transaction happened. Orders carry a real timestamp, so show the time
// too; payments are recorded against a day, so show just the date.
function fmtEntryWhen(entry: LedgerEntry) {
  const d = new Date(entry.date);
  if (entry.type === "order") {
    return d.toLocaleString("en-BD", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

function ShopKhataPage() {
  const [month, setMonth] = useState(currentMonth);
  const cur = currentMonth();

  const { data: myShop } = useQuery({
    queryKey: ["shop/me"],
    queryFn: async () => {
      const res = await api.api.v1.shops.me.$get();
      if (!res.ok) throw new Error("Failed to fetch shop info");
      return res.json() as Promise<{ shopId: string; shopName: string }>;
    },
  });

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
              className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
            >
              <div className="space-y-1">
                <span
                  className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${
                    entry.type === "order"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                      : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  }`}
                >
                  {entry.type === "order"
                    ? `Order #${entry.orderNumber}`
                    : "Payment received"}
                </span>
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
