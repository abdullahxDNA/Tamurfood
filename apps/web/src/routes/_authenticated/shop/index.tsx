import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-context";

export const Route = createFileRoute("/_authenticated/shop/")({
  component: ShopMenu,
});

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
}

interface LastOrder {
  id: string;
  orderNumber: number;
  totalAmount: number;
  placedAt: string;
  items: {
    menuItemId: string;
    itemName: string;
    itemPrice: number;
    quantity: number;
    lineTotal: number;
    isAvailable: boolean;
  }[];
}

async function fetchMenu(): Promise<MenuItem[]> {
  const res = await api.api.v1.menu.$get();
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json() as Promise<MenuItem[]>;
}

async function fetchCategories(): Promise<{ id: string; name: string; sortOrder: number }[]> {
  const res = await api.api.v1.menu.categories.$get();
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json() as Promise<{ id: string; name: string; sortOrder: number }[]>;
}

async function fetchLastOrder(): Promise<LastOrder | null> {
  const res = await api.api.v1.orders.last.$get();
  if (!res.ok) throw new Error("Failed to fetch last order");
  return res.json() as Promise<LastOrder | null>;
}

async function placeOrder(body: {
  items: { menuItemId: string; quantity: number }[];
  note?: string;
}) {
  const res = await api.api.v1.orders.$post({ json: body });
  const data = await res.json() as { id?: string; orderNumber?: number; totalAmount?: number; error?: string; unavailableItems?: string[] };
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Failed to place order"), { status: res.status, data });
  return data as { id: string; orderNumber: number; totalAmount: number };
}

function ShopMenu() {
  const { cart, setQty, clearCart, totalItems, totalAmount } = useCart();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");
  const [successOrder, setSuccessOrder] = useState<{
    orderNumber: number;
    totalAmount: number;
  } | null>(null);
  const [priceMismatch, setPriceMismatch] = useState<number | null>(null);
  const [unavailableWarning, setUnavailableWarning] = useState<string[]>([]);
  const [repeatWarning, setRepeatWarning] = useState<string[]>([]);

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data: lastOrder } = useQuery({
    queryKey: ["orders/last"],
    queryFn: fetchLastOrder,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: placeOrder,
    retry: 3,
    onSuccess: (data) => {
      // Check for server-side price recalculation
      if (data.totalAmount !== totalAmount) {
        setPriceMismatch(data.totalAmount);
      } else {
        setPriceMismatch(null);
      }
      setSuccessOrder({ orderNumber: data.orderNumber, totalAmount: data.totalAmount });
      clearCart();
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["orders/last"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: Error & { status?: number; data?: { unavailableItems?: string[] } }) => {
      if (err.status === 409 && err.data?.unavailableItems) {
        const ids = err.data.unavailableItems;
        setUnavailableWarning(ids.map((id) => cart[id]?.name ?? id));
        // Remove unavailable items from cart
        for (const id of ids) {
          setQty(id, "", 0, 0);
        }
        setConfirmOpen(false);
      }
    },
  });

  function handleRepeatLastOrder() {
    if (!lastOrder) return;
    const warned: string[] = [];
    for (const item of lastOrder.items) {
      if (!item.isAvailable) {
        warned.push(item.itemName);
        continue;
      }
      setQty(item.menuItemId, item.itemName, item.itemPrice, item.quantity);
    }
    if (warned.length > 0) {
      setRepeatWarning(warned);
    }
  }

  function handleConfirmOrder() {
    const orderItems = Object.entries(cart).map(([menuItemId, entry]) => ({
      menuItemId,
      quantity: entry.quantity,
    }));
    mutation.mutate({ items: orderItems, note: note || undefined });
  }

  function handleNewOrder() {
    setSuccessOrder(null);
    setPriceMismatch(null);
    setConfirmOpen(false);
  }

  // Filter by search query
  const q = search.trim().toLowerCase();
  const filteredItems = q
    ? items.filter((i) => i.name.toLowerCase().includes(q))
    : items;

  // Group by category using DB-ordered list, then any uncategorized items
  const categoryNames = categories.map((c) => c.name);
  const grouped: Record<string, MenuItem[]> = {};
  for (const cat of categoryNames) {
    const catItems = filteredItems.filter((i) => i.category === cat);
    if (catItems.length > 0) grouped[cat] = catItems;
  }
  for (const item of filteredItems) {
    if (!categoryNames.includes(item.category)) {
      if (!grouped[item.category]) grouped[item.category] = [];
      if (!grouped[item.category].find((i) => i.id === item.id)) {
        grouped[item.category].push(item);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Menu</h1>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Menu</h1>
        <p className="text-destructive">
          Failed to load menu.{" "}
          <button onClick={() => refetch()} className="underline hover:no-underline">
            Try again
          </button>
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Menu</h1>
        <p className="text-muted-foreground">No menu items available right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Menu</h1>
        <Input
          type="search"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Unavailable warning after server 409 */}
      {unavailableWarning.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Removed unavailable items: {unavailableWarning.join(", ")}
          <button
            className="ml-2 underline"
            onClick={() => setUnavailableWarning([])}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Repeat last order banner */}
      {lastOrder && (
        <div className="rounded-md border bg-muted/50 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Last order: {lastOrder.items.length} item{lastOrder.items.length !== 1 ? "s" : ""} &mdash; ৳{lastOrder.totalAmount}
          </p>
          <div className="flex items-center gap-2">
            {repeatWarning.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Skipped: {repeatWarning.join(", ")}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={handleRepeatLastOrder}>
              Repeat
            </Button>
          </div>
        </div>
      )}

      {/* No search results */}
      {q && Object.keys(grouped).length === 0 && (
        <p className="text-muted-foreground text-sm">No items match "{search}".</p>
      )}

      {/* Menu categories */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="space-y-2">
          <h2 className="text-lg font-semibold border-b pb-1">{category}</h2>
          <div className="divide-y">
            {catItems.map((item) => {
              const qty = cart[item.id]?.quantity ?? 0;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between py-3 px-1 ${!item.isAvailable ? "opacity-50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{item.name}</span>
                      {!item.isAvailable && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-sm font-medium text-muted-foreground w-16 text-right">
                      ৳{item.price}
                    </span>
                    {item.isAvailable && (
                      <div className="flex items-center gap-1">
                        <button
                          className="h-9 w-9 rounded-md border flex items-center justify-center text-lg font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => setQty(item.id, item.name, item.price, Math.max(0, qty - 1))}
                          disabled={qty === 0}
                          aria-label={`Decrease ${item.name}`}
                        >
                          −
                        </button>
                        <span className="w-8 text-center tabular-nums font-medium">
                          {qty || ""}
                        </span>
                        <button
                          className="h-9 w-9 rounded-md border flex items-center justify-center text-lg font-medium hover:bg-muted transition-colors"
                          onClick={() => setQty(item.id, item.name, item.price, qty + 1)}
                          aria-label={`Increase ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Floating cart bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-4 right-4 z-10">
          <button
            className="w-full rounded-xl bg-foreground text-background px-5 py-3 flex items-center justify-between shadow-lg font-medium"
            onClick={() => {
              setSuccessOrder(null);
              setConfirmOpen(true);
            }}
          >
            <span>{totalItems} item{totalItems !== 1 ? "s" : ""} &mdash; ৳{totalAmount}</span>
            <span>Place Order →</span>
          </button>
        </div>
      )}

      {/* Order confirmation sheet */}
      <Sheet open={confirmOpen} onOpenChange={(open) => {
        if (!open && !mutation.isPending) {
          setConfirmOpen(false);
          if (!successOrder) mutation.reset();
        }
      }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {successOrder ? "Order Placed!" : "Confirm Order"}
            </SheetTitle>
          </SheetHeader>

          {successOrder ? (
            <div className="mt-4 space-y-4">
              {priceMismatch !== null && (
                <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
                  Price updated by server: ৳{priceMismatch}
                </div>
              )}
              <div className="rounded-md border bg-muted/50 p-4 text-center space-y-1">
                <p className="text-lg font-semibold">Order #{successOrder.orderNumber}</p>
                <p className="text-muted-foreground">Total: ৳{successOrder.totalAmount}</p>
              </div>
              <Button className="w-full" onClick={handleNewOrder}>
                New Order
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* Cart items */}
              <div className="divide-y rounded-md border overflow-hidden">
                {Object.entries(cart).map(([id, entry]) => (
                  <div key={id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="font-medium">{entry.name}</span>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>×{entry.quantity}</span>
                      <span className="tabular-nums">৳{entry.price * entry.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between font-semibold text-base px-1">
                <span>Total</span>
                <span>৳{totalAmount}</span>
              </div>

              <Textarea
                placeholder="Note (optional)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
              />

              {mutation.isError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {(mutation.error as Error & { status?: number })?.status === 409
                    ? "Some items are no longer available and have been removed from your cart."
                    : "Failed to place order. Please try again."}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleConfirmOrder}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Placing order..." : "Confirm Order"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
