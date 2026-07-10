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
  return new Date(y, m - 1, 1).toLocaleDateString("en-BD", { month: "long", year: "numeric" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-BD", { day: "numeric", month: "short" });
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Khata</h1>

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded border hover:bg-accent"
          onClick={() => setMonth(prevMonth(month))}
        >
          ‹ Prev
        </button>
        <span className="text-sm font-medium">{fmtMonthLabel(month)}</span>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setMonth(nextMonth(month))}
          disabled={month >= cur}
        >
          Next ›
        </button>
      </div>

      {/* Summary card */}
      {data && (
        <div className="rounded-lg border p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ordered this month</span>
            <span className="font-medium">৳{data.monthOrdered.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid this month</span>
            <span className="font-medium text-green-600">৳{data.monthPaid.toLocaleString()}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold text-base">
            <span>Balance due</span>
            <span className={data.outstandingBalance > 0 ? "text-destructive" : "text-green-600"}>
              {data.outstandingBalance > 0
                ? `You owe ৳${data.outstandingBalance.toLocaleString()}`
                : data.outstandingBalance < 0
                  ? `Overpaid ৳${Math.abs(data.outstandingBalance).toLocaleString()}`
                  : "Settled ✓"}
            </span>
          </div>
        </div>
      )}

      {(!myShop || isLoading) && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {data?.entries.length === 0 && (
        <p className="text-muted-foreground text-sm">No transactions this month.</p>
      )}

      {/* Opening balance note */}
      {data && data.openingBalance !== 0 && data.entries.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Opening balance: ৳{data.openingBalance.toLocaleString()}
        </p>
      )}

      {/* Ledger entries */}
      <div className="space-y-2">
        {data?.entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    entry.type === "order"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {entry.type === "order" ? `Order #${entry.orderNumber}` : "Payment received"}
                </span>
                <span className="text-xs text-muted-foreground">{fmtDate(entry.date)}</span>
              </div>
              {entry.note && (
                <p className="text-xs text-muted-foreground italic">"{entry.note}"</p>
              )}
            </div>
            <div className="text-right space-y-0.5">
              <p
                className={`font-medium ${
                  entry.type === "order" ? "text-destructive" : "text-green-600"
                }`}
              >
                {entry.type === "order" ? `+৳${entry.debit}` : `-৳${entry.credit}`}
              </p>
              <p className="text-xs text-muted-foreground">bal: ৳{entry.balance}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
