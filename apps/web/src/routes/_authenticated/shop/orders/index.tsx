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
import { dhakaToday } from "@/lib/date";
import { OrderRef } from "@/components/order-ref";
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
  if (filter === "today") {
    return dhakaToday();
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

// Live status of a shop's order.
function OrderStatusTracker({
  isDone,
  isCancelled,
}: {
  isDone: boolean;
  isCancelled: boolean;
}) {
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5">
        <span className="text-xs font-bold text-red-600 dark:text-red-400">
          ✕ Order Cancelled
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-950/50 p-3">
      <div className="flex items-center">
        <StepNode done label="Placed" />
        <div
          className={cn(
            "mx-2.5 h-1 flex-1 rounded-full transition-all",
            isDone ? "bg-emerald-500" : "bg-stone-200 dark:bg-stone-800",
          )}
        />
        <StepNode
          done={isDone}
          pending={!isDone}
          label={isDone ? "Delivered" : "Pending"}
        />
      </div>
      <p className="mt-2 text-[11px] font-medium text-stone-500 dark:text-stone-400">
        {isDone
          ? "✅ Delivered to your shop!"
          : "⏳ Waiting for bakery approval"}
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
    refetchInterval: filter === "today" ? 20_000 : false,
    refetchOnWindowFocus: true,
  });

  const allOrders = data?.pages.flatMap((p) => p.orders) ?? [];

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

  // Toast when an order transitions from pending → done, so the shop is notified
  // the moment their food is delivered even if they aren't watching the tracker.
  useEffect(() => {
    const orders = data?.pages.flatMap((p) => p.orders) ?? [];
    if (orders.length === 0) return;
    const prev = prevStatusRef.current;

    if (!isFirstLoadRef.current) {
      for (const order of orders) {
        if (prev.get(order.id) === false && order.isDone) {
          toast.success(
            `Order #${order.orderNumber} delivered — enjoy your food!`,
          );
        }
      }
    }

    isFirstLoadRef.current = false;
    prevStatusRef.current = new Map(orders.map((o) => [o.id, o.isDone]));
  }, [data]);

  const handleFilterChange = (f: DateFilter) => {
    setFilter(f);
    // Reset baseline so switching filters doesn't false-fire delivery toasts.
    isFirstLoadRef.current = true;
    prevStatusRef.current = new Map();
  };

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.orders[":id"].cancel.$patch({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to cancel order");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Order cancelled");
      setConfirmCancelId(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      // Reset baseline so the cancel's cache update doesn't false-fire a toast.
      isFirstLoadRef.current = true;
      prevStatusRef.current = new Map();
    },
    onError: () => {
      toast.error("Could not cancel order");
    },
  });

  const handleReorder = (order: Order) => {
    for (const item of order.items) {
      setQty(item.menuItemId, item.itemName, item.itemPrice, item.quantity);
    }
    toast.success("Items added to cart");
    navigate({ to: "/shop" });
  };

  const start = getStartDate(filter);
  const filteredOrders =
    filter === "today"
      ? allOrders
      : allOrders.filter((o) => {
          return new Date(o.placedAt) >= start;
        });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-serif tracking-tight">
          Your Order History
        </h1>
        <span className="text-xs text-stone-400 font-mono">
          {filteredOrders.length} orders
        </span>
      </div>

      {/* Date filter buttons */}
      <div className="flex gap-2">
        {(["today", "week", "month"] as DateFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === f
                ? "bg-amber-700 text-white shadow-xs dark:bg-amber-600"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200/80 dark:bg-stone-900 dark:text-stone-400"
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
            <div
              key={i}
              className="h-28 rounded-2xl bg-stone-100 dark:bg-stone-900 animate-pulse"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-red-500 text-xs py-4">
          Failed to load orders.{" "}
          <button
            onClick={() => refetch()}
            className="underline hover:no-underline font-semibold"
          >
            Try again
          </button>
        </p>
      )}

      {!isLoading && !isError && filteredOrders.length === 0 && (
        <div className="text-center py-16 space-y-2 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
          <p className="text-stone-500 text-sm font-medium">No orders yet.</p>
          <p className="text-xs text-stone-400">
            Place your first order from the menu tab!
          </p>
        </div>
      )}

      <div className="space-y-3.5">
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className={`rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900 p-4.5 space-y-3.5 shadow-xs transition-all ${
              highlightedIds.has(order.id)
                ? "ring-2 ring-amber-600/50 bg-amber-500/5"
                : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <OrderRef
                  className="text-xs font-bold font-mono"
                  dailyNumber={order.dailyNumber}
                  orderNumber={order.orderNumber}
                />
                {highlightedIds.has(order.id) && (
                  <span className="animate-pulse rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                    NEW
                  </span>
                )}
              </div>
              <span className="text-[11px] text-stone-400 font-mono">
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

            <div className="space-y-1.5 divide-y divide-stone-100 dark:divide-stone-800/50 pt-1">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs pt-1.5"
                >
                  <span className="text-stone-700 dark:text-stone-300 font-medium">
                    {item.itemName}{" "}
                    <span className="text-stone-400 font-normal">
                      ×{item.quantity}
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-stone-900 dark:text-stone-100">
                    ৳{item.lineTotal}
                  </span>
                </div>
              ))}
            </div>

            {order.note && (
              <p className="text-[11px] text-stone-500 italic bg-stone-50 dark:bg-stone-950 p-2 rounded-lg">
                Note: {order.note}
              </p>
            )}

            {order.isCancelled && order.cancelReason && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-400">
                Reason: {order.cancelReason}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800/80">
              <div className="text-xs">
                <span className="text-stone-400 text-[10px] uppercase font-bold block">
                  Total Amount
                </span>
                <span className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                  ৳{order.totalAmount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!order.isCancelled && !order.isDone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl"
                    onClick={() => setConfirmCancelId(order.id)}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs rounded-xl font-semibold border-stone-200/80 dark:border-stone-800"
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
