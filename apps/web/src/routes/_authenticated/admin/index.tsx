import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { OrderRef } from "@/components/order-ref";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
// Whether an order was placed today in Bangladesh time — used to keep the
// dashboard's "Mark Paid" button on today's orders only (older unpaid orders
// are settled from the shop's Khata).
function isTodayDhaka(iso: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });
  return fmt.format(new Date(iso)) === fmt.format(new Date());
}
function yesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-BD", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

// One shared AudioContext, reused across chimes. Browsers start it "suspended"
// until a user gesture, so we resume it (see the unlock effect) — otherwise the
// very first order could ring silently.
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function unlockAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

function playChime(muted: boolean) {
  if (muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  try {
    const beep = (start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, start);
      osc.frequency.setValueAtTime(1100, start + 0.15);
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.start(start);
      osc.stop(start + 0.6);
    };
    // Two beeps so staff are more likely to notice.
    beep(ctx.currentTime);
    beep(ctx.currentTime + 0.7);
  } catch {
    // ignore
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
  itemName: string;
  quantity: number;
  lineTotal: number;
}

interface AdminOrder {
  id: string;
  orderNumber: number;
  dailyNumber: number | null;
  shopId: string;
  shopName: string;
  totalAmount: number;
  note: string | null;
  isDone: boolean;
  isPaid: boolean;
  isCancelled: boolean;
  placedAt: string;
  doneAt: string | null;
  items: OrderItem[];
}

interface AnalyticsStats {
  count: number;
  revenue: number;
}
interface AnalyticsData {
  today: AnalyticsStats;
  week: AnalyticsStats;
  month: AnalyticsStats;
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchAdminOrders(date: string) {
  const res = await api.api.v1.admin.orders.$get({ query: { date } });
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json() as Promise<{ orders: AdminOrder[]; total: number }>;
}
async function fetchAnalytics() {
  const res = await api.api.v1.admin.analytics.$get();
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json() as Promise<AnalyticsData>;
}
async function fetchAnalyticsRange(from: string, to: string) {
  const res = await api.api.v1.admin.analytics.range.$get({
    query: { from, to },
  });
  if (!res.ok) throw new Error("Failed to fetch range analytics");
  return res.json() as Promise<{
    from: string;
    to: string;
    count: number;
    revenue: number;
    topShops: { shopName: string; revenue: number; orderCount: number }[];
  }>;
}

async function fetchShopOrders(shopId: string) {
  const res = await api.api.v1.admin.shops[":shopId"].orders.$get({
    param: { shopId },
  });
  if (!res.ok) throw new Error("Failed to fetch shop orders");
  return res.json() as Promise<{ shopName: string; orders: AdminOrder[] }>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ title, stats }: { title: string; stats: AnalyticsStats }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{stats.count} orders</p>
        <p className="text-sm text-muted-foreground">
          ৳{stats.revenue.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function OrderCard({
  order,
  isNew,
  onMarkDone,
  onMarkPaid,
  onCancel,
  onShopClick,
}: {
  order: AdminOrder;
  isNew: boolean;
  onMarkDone?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
  onCancel?: (id: string) => void;
  onShopClick: (id: string, name: string) => void;
}) {
  return (
    <div
      className={`border rounded-lg p-4 space-y-2 transition-all ${
        isNew ? "ring-2 ring-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="font-semibold hover:underline text-left"
            onClick={() => onShopClick(order.shopId, order.shopName)}
          >
            {order.shopName}
          </button>
          <OrderRef
            className="text-sm"
            dailyNumber={order.dailyNumber}
            orderNumber={order.orderNumber}
          />
          {order.isCancelled ? (
            <Badge variant="destructive">Cancelled</Badge>
          ) : (
            <Badge variant={order.isDone ? "secondary" : "default"}>
              {order.isDone ? "Done" : "Pending"}
            </Badge>
          )}
          {order.isDone &&
            !order.isCancelled &&
            (order.isPaid ? (
              <Badge className="border-green-400 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300">
                Paid
              </Badge>
            ) : (
              <Badge className="border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300">
                Unpaid
              </Badge>
            ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {order.isDone ? fmtTime(order.placedAt) : timeAgo(order.placedAt)}
          </span>
          {onMarkDone && !order.isDone && !order.isCancelled && (
            <Button size="sm" onClick={() => onMarkDone(order.id)}>
              Mark Done
            </Button>
          )}
          {onCancel && !order.isDone && !order.isCancelled && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel(order.id)}
            >
              Cancel
            </Button>
          )}
          {onMarkPaid &&
            order.isDone &&
            !order.isPaid &&
            !order.isCancelled && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarkPaid(order.id)}
              >
                Mark Paid
              </Button>
            )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground space-y-0.5">
        {order.items.map((item, i) => (
          <div key={i}>
            {item.quantity}× {item.itemName} — ৳{item.lineTotal}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        {order.note ? (
          <span className="text-muted-foreground italic">"{order.note}"</span>
        ) : (
          <span />
        )}
        <span className="font-semibold">৳{order.totalAmount}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const queryClient = useQueryClient();

  const [muted, setMuted] = useState(
    () =>
      typeof localStorage !== "undefined" &&
      localStorage.getItem("staff-alert-muted") === "true",
  );
  const mutedRef = useRef(muted);
  // Keep the ref in sync for reads inside async SSE callbacks (see playChime),
  // and remember the choice on this device across reloads.
  useEffect(() => {
    mutedRef.current = muted;
    if (typeof localStorage !== "undefined")
      localStorage.setItem("staff-alert-muted", String(muted));
  }, [muted]);

  // Unlock audio on the first user gesture so the first order still rings.
  useEffect(() => {
    const handler = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  const [sseStatus, setSseStatus] = useState<"connected" | "reconnecting">(
    "connected",
  );
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(todayDate);
  const [doneOpen, setDoneOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [confirmDoneId, setConfirmDoneId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmPaidId, setConfirmPaidId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [shopHistory, setShopHistory] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const rangeEnabled = !!rangeFrom && !!rangeTo && rangeFrom <= rangeTo;

  const { data: rangeData, isFetching: rangeFetching } = useQuery({
    queryKey: ["admin/analytics/range", rangeFrom, rangeTo],
    queryFn: () => fetchAnalyticsRange(rangeFrom, rangeTo),
    enabled: rangeEnabled,
  });
  // live "time ago" tick
  const [, setTick] = useState(0);

  // Tick every 30s to refresh relative times
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Queries
  const { data: analytics } = useQuery({
    queryKey: ["admin/analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 60_000,
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["admin/orders", date],
    queryFn: () => fetchAdminOrders(date),
    // Poll so shop-side changes (e.g. a customer cancelling) drop out of the
    // pending list promptly instead of lingering until a manual refresh.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const { data: shopOrdersData } = useQuery({
    queryKey: ["admin/shop-orders", shopHistory?.id],
    queryFn: () => fetchShopOrders(shopHistory!.id),
    enabled: !!shopHistory,
  });

  // Split + sort. Three buckets: to accept → to collect → done.
  // Cancelled orders are not "orders" here — they only appear as done/cancelled.
  const pending = (ordersData?.orders ?? [])
    .filter((o) => !o.isDone && !o.isCancelled)
    .sort(
      (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime(),
    ); // oldest first
  // Accepted but not yet paid (and not cancelled) — collect these during the day.
  const unpaid = (ordersData?.orders ?? [])
    .filter((o) => o.isDone && !o.isPaid && !o.isCancelled)
    .sort(
      (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime(),
    );
  const unpaidTotal = unpaid.reduce((s, o) => s + o.totalAmount, 0);
  // Fully done: paid, or cancelled.
  const done = (ordersData?.orders ?? [])
    .filter((o) => (o.isDone && o.isPaid) || o.isCancelled)
    .sort(
      (a, b) =>
        new Date(b.doneAt ?? b.placedAt).getTime() -
        new Date(a.doneAt ?? a.placedAt).getTime(),
    ); // newest first

  // Tab title
  useEffect(() => {
    document.title =
      pending.length > 0
        ? `(${pending.length}) New Orders — Tamurfood`
        : "Tamurfood Admin";
    return () => {
      document.title = "Tamurfood Admin";
    };
  }, [pending.length]);

  // SSE with reconnect fallback
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      const source = new EventSource("/api/v1/admin/orders/stream");

      source.onopen = () => {
        setSseStatus("connected");
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      source.addEventListener("new_order", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        playChime(mutedRef.current);
        toast.success(`New order #${data.orderNumber} from ${data.shopName}`);
        setHighlightedIds((prev) => new Set([...prev, data.orderId]));
        setTimeout(() => {
          setHighlightedIds((prev) => {
            const next = new Set(prev);
            next.delete(data.orderId);
            return next;
          });
        }, 10_000);
        queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin/analytics"] });
      });

      source.onerror = () => {
        // Guard: only set up poll interval once, not on every retry attempt
        if (source.readyState === EventSource.CLOSED) return;
        setSseStatus("reconnecting");
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
            queryClient.invalidateQueries({ queryKey: ["admin/analytics"] });
          }, 10_000);
        }
      };

      return source;
    };

    const source = connect();
    return () => {
      source.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [queryClient]);

  // Mark done (immutable)
  const markDoneMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const res = await api.api.v1.admin.orders[":id"].done.$patch({
        param: { id },
        json: { paid },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to mark done");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin/analytics"] });
      if (data.paid)
        queryClient.invalidateQueries({ queryKey: ["admin/payments"] });
      toast.success(
        data.paid ? "Order done — payment recorded." : "Order marked as done.",
      );
      setConfirmDoneId(null);
    },
    onError: (err) => {
      // Surface the server message (e.g. cancelled/already done) and refresh so
      // the stale order updates instead of sitting in the pending list.
      toast.error((err as Error).message);
      queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
      setConfirmDoneId(null);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.admin.orders[":id"].paid.$patch({
        param: { id },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to mark paid");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin/shop-orders"] });
      toast.success("Marked as paid — payment recorded.");
      setConfirmPaidId(null);
    },
    onError: (err) => {
      toast.error((err as Error).message);
      queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
      setConfirmPaidId(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.api.v1.admin.orders[":id"].cancel.$patch({
        param: { id },
        json: reason ? { reason } : {},
      });
      if (!res.ok) throw new Error("Failed to cancel order");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin/orders"] });
      toast.success("Order cancelled.");
      setConfirmCancelId(null);
      setCancelReason("");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const paidOrder = (ordersData?.orders ?? []).find(
    (o) => o.id === confirmPaidId,
  );

  const isToday = date === todayDate();
  const isYesterday = date === yesterdayDate();

  return (
    <div className="space-y-5">
      {/* Reconnect banner */}
      {sseStatus === "reconnecting" && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-900 dark:text-yellow-200">
          Lost connection to server. Trying to reconnect… Orders refresh every
          10s.
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          {/* Date filter */}
          <div className="flex items-center rounded-md border overflow-hidden text-sm">
            <button
              className={`px-3 py-1.5 ${isToday ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setDate(todayDate())}
            >
              Today
            </button>
            <button
              className={`px-3 py-1.5 border-l ${isYesterday ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setDate(yesterdayDate())}
            >
              Yesterday
            </button>
            <input
              type="date"
              value={!isToday && !isYesterday ? date : ""}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="px-2 py-1.5 border-l bg-transparent text-xs w-36 cursor-pointer dark:[color-scheme:dark]"
              placeholder="Pick date"
            />
          </div>
          {/* Mute toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Unmute alerts" : "Mute alerts"}
          >
            {muted ? "🔇 Muted" : "🔔 Sound"}
          </Button>
        </div>
      </div>

      {/* ── At-a-glance summary strip ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="mt-0.5 text-2xl font-bold leading-none">
            {pending.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">to accept</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            To collect
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-none text-amber-700 dark:text-amber-300">
            ৳{unpaidTotal.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-amber-700/70 dark:text-amber-400/70">
            {unpaid.length} unpaid
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="mt-0.5 text-2xl font-bold leading-none">
            {done.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            paid / cancelled
          </p>
        </div>
      </div>

      {/* ── Pending (needs action) ── */}
      <section className="rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Pending</h2>
          {pending.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
              {pending.length}
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Mark Done to accept
          </span>
        </div>
        <div className="space-y-3 p-3">
          {isLoading && (
            <p className="text-muted-foreground text-sm">Loading…</p>
          )}
          {!isLoading && pending.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No pending orders for this date.
            </p>
          )}
          {pending.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isNew={highlightedIds.has(order.id)}
              onMarkDone={(id) => setConfirmDoneId(id)}
              onCancel={(id) => setConfirmCancelId(id)}
              onShopClick={(id, name) => setShopHistory({ id, name })}
            />
          ))}
        </div>
      </section>

      {/* ── Unpaid (to collect today) ── */}
      {unpaid.length > 0 && (
        <section className="rounded-lg border border-amber-200 dark:border-amber-900">
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900 dark:bg-amber-950/20">
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              To collect
            </h2>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {unpaid.length}
            </span>
            <span className="ml-auto text-xs font-medium text-amber-700 dark:text-amber-400">
              ৳{unpaidTotal.toLocaleString()} outstanding
            </span>
          </div>
          <div className="space-y-3 p-3">
            {unpaid.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isNew={false}
                onMarkPaid={
                  isTodayDhaka(order.placedAt)
                    ? (id) => setConfirmPaidId(id)
                    : undefined
                }
                onShopClick={(id, name) => setShopHistory({ id, name })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Completed (collapsible) ── */}
      {done.length > 0 && (
        <section className="rounded-lg border">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-muted/40"
            onClick={() => setDoneOpen((o) => !o)}
          >
            <span>Completed</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {done.length}
            </span>
            <span className="ml-auto text-muted-foreground text-xs">
              {doneOpen ? "▲ Hide" : "▼ Show"}
            </span>
          </button>
          {doneOpen && (
            <div className="space-y-3 border-t p-3">
              {done.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isNew={false}
                  // Mark Paid only for today's orders; older unpaid orders are
                  // settled from the shop's Khata.
                  onMarkPaid={
                    isTodayDhaka(order.placedAt)
                      ? (id) => setConfirmPaidId(id)
                      : undefined
                  }
                  onShopClick={(id, name) => setShopHistory({ id, name })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Sales & analytics (separate from the live queue, collapsible) ── */}
      {analytics && (
        <section className="rounded-lg border">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-muted/40"
            onClick={() => setAnalyticsOpen((o) => !o)}
          >
            <span>Sales &amp; Analytics</span>
            <span className="ml-auto text-muted-foreground text-xs">
              {analyticsOpen ? "▲ Hide" : "▼ Show"}
            </span>
          </button>
          {analyticsOpen && (
            <div className="space-y-4 border-t p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Today" stats={analytics.today} />
                <StatCard title="This Week" stats={analytics.week} />
                <StatCard title="This Month" stats={analytics.month} />
              </div>

              {/* Date range picker */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Custom Date Range</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm bg-background dark:[color-scheme:dark]"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm bg-background dark:[color-scheme:dark]"
                  />
                </div>
                {rangeEnabled && (
                  <div>
                    {rangeFetching ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : rangeData ? (
                      <div className="space-y-2">
                        <div className="flex gap-6">
                          <div>
                            <p className="text-2xl font-bold">
                              {rangeData.count} orders
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ৳{rangeData.revenue.toLocaleString()} revenue
                            </p>
                          </div>
                        </div>
                        {rangeData.topShops.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              Top shops
                            </p>
                            {rangeData.topShops.map((s) => (
                              <div
                                key={s.shopName}
                                className="flex justify-between text-sm"
                              >
                                <span>{s.shopName}</span>
                                <span className="text-muted-foreground">
                                  ৳{s.revenue.toLocaleString()} · {s.orderCount}{" "}
                                  orders
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
                {rangeFrom && rangeTo && rangeFrom > rangeTo && (
                  <p className="text-sm text-destructive">
                    Start date must be before end date.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Confirm mark-done dialog */}
      <Dialog
        open={confirmDoneId !== null}
        onOpenChange={(open) => {
          if (!open && !markDoneMutation.isPending) setConfirmDoneId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark order as done?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Was this order paid?</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDoneId(null)}
              disabled={markDoneMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                confirmDoneId &&
                markDoneMutation.mutate({ id: confirmDoneId, paid: false })
              }
              disabled={markDoneMutation.isPending}
            >
              Done — Unpaid
            </Button>
            <Button
              onClick={() =>
                confirmDoneId &&
                markDoneMutation.mutate({ id: confirmDoneId, paid: true })
              }
              disabled={markDoneMutation.isPending}
            >
              {markDoneMutation.isPending ? "Saving…" : "Done + Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm mark-paid dialog */}
      <Dialog
        open={confirmPaidId !== null}
        onOpenChange={(open) => {
          if (!open && !markPaidMutation.isPending) setConfirmPaidId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this order as paid?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {paidOrder
              ? `This records a payment of ৳${paidOrder.totalAmount.toLocaleString()} from ${paidOrder.shopName} for order #${paidOrder.dailyNumber ?? paidOrder.orderNumber}.`
              : "This records a payment for the order."}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmPaidId(null)}
              disabled={markPaidMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                confirmPaidId && markPaidMutation.mutate(confirmPaidId)
              }
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? "Saving…" : "Yes, mark paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm cancel dialog */}
      <Dialog
        open={confirmCancelId !== null}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) {
            setConfirmCancelId(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The order will be moved to Completed as Cancelled.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reason for the shop (optional)
            </label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Sorry, stock out"
              rows={2}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              The shop sees this on the order in their history.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmCancelId(null);
                setCancelReason("");
              }}
              disabled={cancelMutation.isPending}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmCancelId &&
                cancelMutation.mutate({
                  id: confirmCancelId,
                  reason: cancelReason.trim() || undefined,
                })
              }
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shop history sheet */}
      <Sheet
        open={!!shopHistory}
        onOpenChange={(open) => !open && setShopHistory(null)}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {shopOrdersData?.shopName ?? shopHistory?.name} — Order History
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {!shopOrdersData && (
              <p className="text-muted-foreground text-sm">Loading…</p>
            )}
            {shopOrdersData?.orders.length === 0 && (
              <p className="text-muted-foreground text-sm">No orders yet.</p>
            )}
            {shopOrdersData?.orders.map((order) => (
              <div key={order.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <OrderRef
                      className="text-sm"
                      dailyNumber={order.dailyNumber}
                      orderNumber={order.orderNumber}
                    />
                    <Badge
                      variant={order.isDone ? "secondary" : "default"}
                      className="text-xs"
                    >
                      {order.isDone ? "Done" : "Pending"}
                    </Badge>
                    {order.isDone && !order.isCancelled && (
                      <Badge
                        className={
                          order.isPaid
                            ? "text-xs border-green-400 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300"
                            : "text-xs border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                        }
                      >
                        {order.isPaid ? "Paid" : "Unpaid"}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(order.placedAt)} {fmtTime(order.placedAt)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {order.items.map((item, i) => (
                    <div key={i}>
                      {item.quantity}× {item.itemName} — ৳{item.lineTotal}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm">
                  {order.note ? (
                    <span className="text-muted-foreground italic text-xs">
                      "{order.note}"
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="font-semibold">৳{order.totalAmount}</span>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
