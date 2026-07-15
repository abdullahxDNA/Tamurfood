import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/khata/")({
  component: KhataPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShopBalance {
  shopId: string;
  shopName: string;
  totalOrdered: number;
  totalPaid: number;
  balance: number;
}

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

interface UnpaidOrder {
  id: string;
  orderNumber: number;
  dailyNumber: number | null;
  amount: number;
  placedAt: string;
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

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchOverview(): Promise<ShopBalance[]> {
  const res = await api.api.v1.khata.overview.$get();
  if (!res.ok) throw new Error("Failed to fetch khata overview");
  return res.json() as Promise<ShopBalance[]>;
}

async function fetchLedger(shopId: string, month: string): Promise<ShopLedger> {
  const res = await api.api.v1.khata[":shopId"].$get({
    param: { shopId },
    query: { month },
  });
  if (!res.ok) throw new Error("Failed to fetch ledger");
  return res.json() as Promise<ShopLedger>;
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
}

function BalanceBadge({ balance }: { balance: number }) {
  if (balance > 0)
    return (
      <Badge variant="destructive">Owes ৳{balance.toLocaleString()}</Badge>
    );
  if (balance < 0)
    return (
      <Badge variant="secondary">
        Overpaid ৳{Math.abs(balance).toLocaleString()}
      </Badge>
    );
  return <Badge variant="outline">Settled</Badge>;
}

// ─── Ledger Sheet ─────────────────────────────────────────────────────────────

function LedgerSheet({
  shop,
  onClose,
}: {
  shop: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(currentMonth);
  const cur = currentMonth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["khata/ledger", shop?.id, month],
    queryFn: () => fetchLedger(shop!.id, month),
    enabled: !!shop,
  });

  const markPaidMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.api.v1.admin.orders[":id"].paid.$patch({
        param: { id: orderId },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to mark paid");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["khata/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["khata/overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
      toast.success("Order marked as paid.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet open={!!shop} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{shop?.name} — Khata</SheetTitle>
        </SheetHeader>

        {/* Balance headline — the authoritative "what they owe" number */}
        {data && (
          <div className="mt-4 rounded-lg border p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Outstanding balance
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.outstandingBalance > 0
                  ? "text-destructive"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              ৳{Math.abs(data.outstandingBalance).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.outstandingBalance > 0
                ? "owed to you"
                : data.outstandingBalance < 0
                  ? "overpaid"
                  : "all settled"}
            </p>
          </div>
        )}

        {/* Unpaid orders (any date) — settle them from here */}
        {data && data.unpaidOrders.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold">
              Unpaid orders ({data.unpaidOrders.length})
            </h3>
            <div className="space-y-2">
              {data.unpaidOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950/20"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">
                      #{o.dailyNumber ?? o.orderNumber}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {fmtDate(o.placedAt)} · ৳{o.amount.toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    disabled={markPaidMutation.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Mark order #${o.dailyNumber ?? o.orderNumber} as paid (৳${o.amount})? This records a payment.`,
                        )
                      )
                        markPaidMutation.mutate(o.id);
                    }}
                  >
                    Paid
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Month navigator */}
        <div className="flex items-center justify-between mt-4 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(prevMonth(month))}
          >
            ‹ Prev
          </Button>
          <span className="text-sm font-medium">{fmtMonthLabel(month)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(nextMonth(month))}
            disabled={month >= cur}
          >
            Next ›
          </Button>
        </div>

        {/* Summary card */}
        {data && (
          <div className="rounded-lg border p-4 mb-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ordered this month</span>
              <span className="font-medium">
                ৳{data.monthOrdered.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid this month</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                ৳{data.monthPaid.toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-1 flex justify-between font-semibold">
              <span>Outstanding balance</span>
              <span
                className={
                  data.outstandingBalance > 0
                    ? "text-destructive"
                    : "text-green-600 dark:text-green-400"
                }
              >
                {data.outstandingBalance > 0 ? "+" : ""}৳
                {data.outstandingBalance.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {data?.entries.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No transactions this month.
          </p>
        )}

        {/* Opening balance row */}
        {data && data.openingBalance !== 0 && (
          <div className="text-xs text-muted-foreground text-center mb-2">
            Opening balance: ৳{data.openingBalance.toLocaleString()}
          </div>
        )}

        {/* Ledger entries */}
        <div className="space-y-2">
          {data?.entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      entry.type === "order"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                        : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                    }`}
                  >
                    {entry.type === "order"
                      ? `Order #${entry.orderNumber}`
                      : "Payment"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(entry.date)}
                  </span>
                </div>
                {entry.note && (
                  <p className="text-xs text-muted-foreground italic">
                    "{entry.note}"
                  </p>
                )}
              </div>
              <div className="text-right space-y-0.5">
                <p
                  className={
                    entry.type === "order"
                      ? "text-destructive font-medium"
                      : "text-green-600 dark:text-green-400 font-medium"
                  }
                >
                  {entry.type === "order"
                    ? `+৳${entry.debit}`
                    : `-৳${entry.credit}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  bal: ৳{entry.balance}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function KhataPage() {
  const [selectedShop, setSelectedShop] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const {
    data: overview = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["khata/overview"],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Khata</h1>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {isError && <p className="text-destructive">Failed to load khata.</p>}

      {!isLoading && overview.length === 0 && (
        <p className="text-muted-foreground">No shops found.</p>
      )}

      {overview.length > 0 && (
        <div className="space-y-2">
          {overview.map((shop) => (
            <button
              key={shop.shopId}
              type="button"
              onClick={() =>
                setSelectedShop({ id: shop.shopId, name: shop.shopName })
              }
              className="w-full text-left rounded-lg border px-4 py-3 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{shop.shopName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ordered: ৳{shop.totalOrdered.toLocaleString()} · Paid: ৳
                    {shop.totalPaid.toLocaleString()}
                  </p>
                </div>
                <BalanceBadge balance={shop.balance} />
              </div>
            </button>
          ))}
        </div>
      )}

      <LedgerSheet shop={selectedShop} onClose={() => setSelectedShop(null)} />
    </div>
  );
}
