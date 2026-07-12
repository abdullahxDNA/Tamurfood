import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
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
  totalAmount: number;
  note: string | null;
  isDone: boolean;
  isCancelled: boolean;
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

function OrderHistory() {
  const { setQty } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<DateFilter>("today");
  const [page, setPage] = useState(1);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Track previous isDone state to detect "order ready" transitions
  const prevStatusRef = useRef<Map<string, boolean>>(new Map());
  const isFirstLoadRef = useRef(true);

  const dateParam = filter === "today" ? getDateParam(filter) : undefined;

  const { isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", filter, page],
    queryFn: async () => {
      const result = await fetchOrders(page, dateParam);
      if (page === 1) {
        setAllOrders(result.orders);
      } else {
        setAllOrders((prev) => [...prev, ...result.orders]);
      }
      setHasMore(page * result.pageSize < result.total);
      return result;
    },
    staleTime: 30 * 1000,
    // Poll every 20s on "today" view so shop sees when orders flip to done
    refetchInterval: filter === "today" ? 20_000 : false,
  });

  // Toast when an order transitions from pending → done
  useEffect(() => {
    if (allOrders.length === 0) return;
    const prev = prevStatusRef.current;

    if (!isFirstLoadRef.current) {
      for (const order of allOrders) {
        if (prev.get(order.id) === false && order.isDone) {
          toast.success(`Order #${order.orderNumber} is ready for pickup!`);
        }
      }
    }

    isFirstLoadRef.current = false;
    prevStatusRef.current = new Map(allOrders.map((o) => [o.id, o.isDone]));
  }, [allOrders]);

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
      // Reset so next refetch re-populates allOrders cleanly
      setPage(1);
      setAllOrders([]);
      isFirstLoadRef.current = true;
      prevStatusRef.current = new Map();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  function handleFilterChange(newFilter: DateFilter) {
    setFilter(newFilter);
    setPage(1);
    setAllOrders([]);
    isFirstLoadRef.current = true;
    prevStatusRef.current = new Map();
  }

  function handleLoadMore() {
    setPage((p) => p + 1);
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

      {isLoading && page === 1 && (
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
          <div key={order.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  #{order.orderNumber}
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
              {order.isCancelled ? (
                <Badge variant="destructive">Cancelled</Badge>
              ) : order.isDone ? (
                <Badge variant="default">Ready</Badge>
              ) : (
                <Badge variant="secondary">Pending</Badge>
              )}
            </div>

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

      {hasMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleLoadMore}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Load more"}
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
