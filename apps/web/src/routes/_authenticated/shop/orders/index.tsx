import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCart } from "@/lib/cart-context";

export const Route = createFileRoute("/_authenticated/shop/orders/")({
  component: OrderHistory,
});

type DateFilter = "today" | "week" | "month";

interface OrderItem {
  menuItemId: string;
  itemName: string;
  itemPrice: number;
  quantity: number;
  lineTotal: number;
}

interface Order {
  id: string;
  orderNumber: number;
  dailyNumber: number | null;
  totalAmount: number;
  note: string | null;
  isDone: boolean;
  isCancelled: boolean;
  cancelReason: string | null;
  placedAt: string;
  items: OrderItem[];
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}

function getDateParam(filter: DateFilter): string | undefined {
  const now = new Date();
  if (filter === "today") {
    return now.toISOString().slice(0, 10);
  }
  return undefined;
}

function getStartDate(filter: DateFilter): Date {
  const now = new Date();
  if (filter === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (filter === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function fetchOrders(
  page: number,
  date?: string,
): Promise<OrdersResponse> {
  const query: Record<string, string> = { page: String(page) };
  if (date) query.date = date;
  const res = await api.api.v1.orders.$get({ query });
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json() as Promise<OrdersResponse>;
}

// A single milestone in the order tracker.
function StepNode({
  done,
  pending,
  label,
}: {
  done: boolean;
  pending?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
          done
            ? "bg-green-500 text-white"
            : pending
              ? "animate-pulse border-2 border-amber-400 text-amber-500"
              : "bg-muted text-muted-foreground",
        )}
      >
        {done ? "✓" : ""}
      </span>
      <span
        className={cn(
          "text-xs font-medium",
          done
            ? "text-foreground"
            : pending
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

// Live status of a shop's order. Two real milestones (Placed → Accepted) plus a
// terminal Cancelled state — matching the staff's single "Mark Done" action.
function OrderStatusTracker({
  isDone,
  isCancelled,
}: {
  isDone: boolean;
  isCancelled: boolean;
}) {
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
        <span className="text-sm font-bold text-destructive">✕</span>
        <span className="text-sm font-medium text-destructive">
          Order cancelled
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center">
        <StepNode done label="Placed" />
        <div
          className={cn(
            "mx-2 h-0.5 flex-1 rounded",
            isDone ? "bg-green-500" : "bg-muted-foreground/25",
          )}
        />
        <StepNode
          done={isDone}
          pending={!isDone}
          label={isDone ? "Accepted" : "Waiting"}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {isDone
          ? "✅ Accepted — your food will be delivered in a few minutes."
          : "⏳ Waiting for the bakery to accept your order…"}
      </p>
    </div>
  );
}

// Must match the key the shop layout writes to (see shop.tsx). Holds IDs of
// orders that changed while the shop was away, so they can be flashed as "NEW".
const NEW_ORDERS_KEY = "shop-new-orders";
// How long a "NEW" marker lingers after the shop sees it, then clears.
const NEW_MARKER_MS = 10000;

function OrderHistory() {
  const { setQty } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<DateFilter>("today");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Track previous isDone state to detect "order ready" transitions
  const prevStatusRef = useRef<Map<string, boolean>>(new Map());
  const isFirstLoadRef = useRef(true);

  const dateParam = filter === "today" ? getDateParam(filter) : undefined;

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["orders", filter],
    queryFn: ({ pageParam }) => fetchOrders(pageParam, dateParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      pages.length * lastPage.pageSize < lastPage.total
        ? pages.length + 1
        : undefined,
    staleTime: 0,
    // Status changes arrive instantly over SSE (see effect below). This poll is
    // just a fallback for when the stream is down — hence the relaxed interval.
    refetchInterval: filter === "today" ? 20_000 : false,
    // Refetch the moment the shop returns to the tab, so status is fresh
    // immediately instead of waiting for the next poll tick.
    refetchOnWindowFocus: true,
  });

  // Derived from the cache — always in sync, even when returning to a filter.
  const allOrders = data?.pages.flatMap((p) => p.orders) ?? [];

  // Orders that changed recently get a "NEW" marker for a few seconds. The timer
  // starts when the shop actually sees it — either the moment a live event
  // arrives while on this page, or when the page opens for events stashed by the
  // layout while the shop was on another tab.
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

  // Clear pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // On open, flash anything that changed while the shop was on another tab.
  useEffect(() => {
    let ids: string[] = [];
    try {
      const raw = localStorage.getItem(NEW_ORDERS_KEY);
      if (!raw) return;
      localStorage.removeItem(NEW_ORDERS_KEY);
      ids = JSON.parse(raw) as string[];
    } catch {
      return;
    }
    // Defer so we're not calling setState synchronously inside the effect.
    const t = setTimeout(() => {
      for (const id of ids) markNew(id);
    }, 0);
    return () => clearTimeout(t);
  }, [markNew]);

  // Live status via SSE: refetch the instant staff accept/cancel an order for
  // this shop, so the tracker flips with no polling delay, and flash the changed
  // order as NEW. EventSource auto-reconnects; the poll above covers any gap.
  useEffect(() => {
    const source = new EventSource("/api/v1/orders/stream");
    source.addEventListener("order_status", (e) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      try {
        const { orderId } = JSON.parse((e as MessageEvent).data) as {
          orderId?: string;
        };
        if (orderId) markNew(orderId);
      } catch {
        /* ignore */
      }
    });
    return () => source.close();
  }, [queryClient, markNew]);

  // Toast when an order transitions from pending → done
  useEffect(() => {
    const orders = data?.pages.flatMap((p) => p.orders) ?? [];
    if (orders.length === 0) return;
    const prev = prevStatusRef.current;

    if (!isFirstLoadRef.current) {
      for (const order of orders) {
        if (prev.get(order.id) === false && order.isDone) {
          toast.success(
            `Order #${order.orderNumber} accepted — food will be delivered in a few minutes!`,
          );
        }
      }
    }

    isFirstLoadRef.current = false;
    prevStatusRef.current = new Map(orders.map((o) => [o.id, o.isDone]));
  }, [data]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.orders[":id"].cancel.$patch({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to cancel order");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Order cancelled.");
      setConfirmCancelId(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      isFirstLoadRef.current = true;
      prevStatusRef.current = new Map();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  function handleFilterChange(newFilter: DateFilter) {
    setFilter(newFilter);
    isFirstLoadRef.current = true;
    prevStatusRef.current = new Map();
  }

  function handleReorder(order: Order) {
    for (const item of order.items) {
      setQty(item.menuItemId, item.itemName, item.itemPrice, item.quantity);
    }
    navigate({ to: "/shop" });
  }

  // Client-side date filter for week/month
  const filteredOrders =
    filter === "today"
      ? allOrders
      : allOrders.filter((o) => {
          const start = getStartDate(filter);
          return new Date(o.placedAt) >= start;
        });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>

      {/* Date filter buttons */}
      <div className="flex gap-2">
        {(["today", "week", "month"] as DateFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {f === "today"
              ? "Today"
              : f === "week"
                ? "This Week"
                : "This Month"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive text-sm">
          Failed to load orders.{" "}
          <button
            onClick={() => refetch()}
            className="underline hover:no-underline"
          >
            Try again
          </button>
        </p>
      )}

      {!isLoading && !isError && filteredOrders.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-muted-foreground">No orders yet.</p>
          <p className="text-sm text-muted-foreground">
            Place your first order from the menu!
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className={`rounded-lg border p-4 space-y-3 transition-all ${
              highlightedIds.has(order.id)
                ? "ring-2 ring-primary bg-primary/5"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                #{order.dailyNumber ?? order.orderNumber}
              </span>
              {highlightedIds.has(order.id) && (
                <span className="animate-pulse rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                  NEW
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                Ref #{order.orderNumber}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(order.placedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {/* Live status tracker */}
            <OrderStatusTracker
              isDone={order.isDone}
              isCancelled={order.isCancelled}
            />

            <div className="space-y-1">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {item.itemName} ×{item.quantity}
                  </span>
                  <span className="tabular-nums">৳{item.lineTotal}</span>
                </div>
              ))}
            </div>

            {order.note && (
              <p className="text-xs text-muted-foreground italic">
                Note: {order.note}
              </p>
            )}

            {order.isCancelled && order.cancelReason && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                Cancelled: {order.cancelReason}
              </p>
            )}

            <div className="flex items-center justify-between pt-1 border-t">
              <span className="font-semibold text-sm">
                ৳{order.totalAmount}
              </span>
              <div className="flex items-center gap-2">
                {!order.isCancelled && !order.isDone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmCancelId(order.id)}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReorder(order)}
                >
                  Reorder
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasNextPage && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </Button>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog
        open={confirmCancelId !== null}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) setConfirmCancelId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This cannot be undone. The order will be marked as cancelled.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmCancelId(null)}
              disabled={cancelMutation.isPending}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmCancelId && cancelMutation.mutate(confirmCancelId)
              }
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
