import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  stockQuantity: number | null;
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

async function fetchCategories(): Promise<
  { id: string; name: string; sortOrder: number }[]
> {
  const res = await api.api.v1.menu.categories.$get();
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json() as Promise<
    { id: string; name: string; sortOrder: number }[]
  >;
}

async function fetchLastOrder(): Promise<LastOrder | null> {
  const res = await api.api.v1.orders.last.$get();
  if (!res.ok) throw new Error("Failed to fetch last order");
  return res.json() as Promise<LastOrder | null>;
}

interface Banner {
  title: string | null;
  subtitle: string | null;
  tagline: string | null;
  imageUrl: string | null;
  enabled: boolean;
}

async function fetchBanner(): Promise<Banner | null> {
  const res = await api.api.v1.banner.$get();
  if (!res.ok) throw new Error("Failed to fetch banner");
  return res.json() as Promise<Banner | null>;
}

async function placeOrder(body: {
  items: { menuItemId: string; quantity: number }[];
  note?: string;
}) {
  const res = await api.api.v1.orders.$post({ json: body });
  const data = (await res.json()) as {
    id?: string;
    orderNumber?: number;
    dailyNumber?: number;
    totalAmount?: number;
    error?: string;
    unavailableItems?: string[];
  };
  if (!res.ok)
    throw Object.assign(new Error(data.error ?? "Failed to place order"), {
      status: res.status,
      data,
    });
  return data as {
    id: string;
    orderNumber: number;
    dailyNumber: number;
    totalAmount: number;
  };
}

// ─── Food visuals ─────────────────────────────────────────────────────────────
// Each food type maps to a real stock photo (Unsplash) + an emoji fallback.
// When item.imageUrl is set (a real photo uploaded via admin), that is used
// instead. If a stock photo fails to load, the emoji shows through.

const FOOD_MAP: { keywords: string[]; emoji: string; img: string }[] = [
  { keywords: ["samosa", "singara", "somosa"], emoji: "🥟", img: "1601050690597-df0568f70950" }, // prettier-ignore
  { keywords: ["roll"], emoji: "🌯", img: "1626700051175-6818013e1d4f" },
  { keywords: ["kabab", "keema", "kebab"], emoji: "🍢", img: "1529193591184-b1d58069ecdd" }, // prettier-ignore
  { keywords: ["paratha", "porota", "puri", "ruti", "bakarkhani"], emoji: "🫓", img: "1565557623262-b51c2513a641" }, // prettier-ignore
  { keywords: ["cake"], emoji: "🍰", img: "1578985545062-69928b1d9587" },
  { keywords: ["bun", "danish", "bread"], emoji: "🍞", img: "1509440159596-0249088772ff" }, // prettier-ignore
  { keywords: ["biscuit", "cookie"], emoji: "🍪", img: "1499636136210-6f4ee915583e" }, // prettier-ignore
  {
    keywords: ["chaa", "cha", "tea"],
    emoji: "🍵",
    img: "1544787219-7f47ccb76574",
  },
  { keywords: ["jilapi", "misti", "mithai", "sweet"], emoji: "🍥", img: "1606313564200-e75d5e30476c" }, // prettier-ignore
  { keywords: ["sandwich"], emoji: "🥪", img: "1528735602780-2552fd46c7af" },
  { keywords: ["piyaju", "patties", "peyaju", "onthon"], emoji: "🧆", img: "1606491956689-2ea866880c84" }, // prettier-ignore
  { keywords: ["dim", "egg", "anda"], emoji: "🥚", img: "1482049016688-2d3e1b311543" }, // prettier-ignore
];

const DEFAULT_IMG = "1504674900247-0877df9cc836"; // generic food flatlay

function foodMatch(name: string) {
  const n = name.toLowerCase();
  return FOOD_MAP.find((f) => f.keywords.some((k) => n.includes(k)));
}

function foodEmoji(name: string): string {
  return foodMatch(name)?.emoji ?? "🍽️";
}

function foodImage(name: string): string {
  const id = foodMatch(name)?.img ?? DEFAULT_IMG;
  return `https://images.unsplash.com/photo-${id}?w=400&h=300&fit=crop&q=80`;
}

const GRADIENTS = [
  "from-amber-100 to-orange-200",
  "from-rose-100 to-red-200",
  "from-lime-100 to-green-200",
  "from-sky-100 to-blue-200",
  "from-violet-100 to-purple-200",
  "from-yellow-100 to-amber-200",
];

const MOCK_TAGLINES = [
  "Freshly made daily",
  "Baked this morning",
  "House favourite",
  "Made to order",
  "Crispy & fresh",
];

// Deterministic pick so a given item always looks the same.
function hashPick<T>(id: string, arr: T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

function ShopMenu() {
  const { cart, setQty, clearCart, totalItems, totalAmount } = useCart();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");
  const [successOrder, setSuccessOrder] = useState<{
    orderNumber: number;
    dailyNumber: number;
    totalAmount: number;
  } | null>(null);
  const [priceMismatch, setPriceMismatch] = useState<number | null>(null);
  const [unavailableWarning, setUnavailableWarning] = useState<string[]>([]);

  // Sticky category bar: refs to each section + the currently-visible category
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeCategory, setActiveCategory] = useState<string>("");

  function scrollToCategory(cat: string) {
    sectionRefs.current[cat]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setActiveCategory(cat);
  }

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu,
    // Near-real-time stock updates: poll every 5s while the tab is open
    // (React Query auto-pauses this when the tab is backgrounded) and refetch
    // immediately when the shop returns to the tab, so a stock-out toggled by
    // admin/moderator shows up within ~5s without a manual refresh.
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
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

  const { data: banner } = useQuery({
    queryKey: ["banner"],
    queryFn: fetchBanner,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: placeOrder,
    // Retry transient failures, but never a 409 (stock-out) — that's a
    // definitive answer the shop needs to see instantly, not after 3 retries.
    retry: (failureCount, error) =>
      (error as { status?: number })?.status === 409 ? false : failureCount < 3,
    onSuccess: (data) => {
      // Check for server-side price recalculation
      if (data.totalAmount !== totalAmount) {
        setPriceMismatch(data.totalAmount);
      } else {
        setPriceMismatch(null);
      }
      setSuccessOrder({
        orderNumber: data.orderNumber,
        dailyNumber: data.dailyNumber,
        totalAmount: data.totalAmount,
      });
      clearCart();
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["orders/last"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (
      err: Error & { status?: number; data?: { unavailableItems?: string[] } },
    ) => {
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
      toast(`Skipped unavailable: ${warned.join(", ")}`);
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

  function handleClearCart() {
    // Snapshot the cart so it can be restored if the clear was accidental.
    const snapshot = Object.entries(cart).map(([id, entry]) => ({
      id,
      ...entry,
    }));
    clearCart();
    const id = toast("Cart cleared", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          for (const item of snapshot) {
            setQty(item.id, item.name, item.price, item.quantity);
          }
          toast.dismiss(id);
        },
      },
    });
    // Failsafe: on touch devices, tapping the toast pauses sonner's auto-dismiss
    // timer and it never resumes, leaving the bar stuck. Force it to close.
    setTimeout(() => toast.dismiss(id), 5500);
  }

  // Proactively drop cart items that just went stock-out — detected by the 5s
  // menu poll, so the shop is told immediately instead of at checkout. An item
  // is out when it's toggled off OR its tracked stock hit 0.
  useEffect(() => {
    if (items.length === 0) return;
    const outById = new Map(
      items.map((i) => [i.id, !i.isAvailable || i.stockQuantity === 0]),
    );
    const nowOut = Object.entries(cart).filter(
      ([id]) => outById.get(id) === true,
    );
    if (nowOut.length === 0) return;
    for (const [id, entry] of nowOut) {
      setQty(id, "", 0, 0);
      toast(`${entry.name} is now stock out — removed from your cart`);
    }
  }, [items, cart, setQty]);

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

  const categoryKeys = Object.keys(grouped);
  const categoryKey = categoryKeys.join("|");

  // Highlight the category currently in view (scroll-spy).
  useEffect(() => {
    const cats = categoryKey ? categoryKey.split("|") : [];
    if (cats.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const cat = visible[0]?.target.getAttribute("data-category");
        if (cat) setActiveCategory(cat);
      },
      { rootMargin: "-64px 0px -70% 0px" },
    );
    for (const cat of cats) {
      const el = sectionRefs.current[cat];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categoryKey]);

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
          <button
            onClick={() => refetch()}
            className="underline hover:no-underline"
          >
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
        <p className="text-muted-foreground">
          No menu items available right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Full-width hero banner — content managed from Admin → Banner */}
      {banner?.enabled !== false && (
        <div
          className="relative left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm"
          style={
            banner?.imageUrl
              ? {
                  backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.15)), url(${banner.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
            <p className="text-xs font-medium uppercase tracking-wide opacity-90">
              {banner?.subtitle ?? "Today's special"}
            </p>
            <h2 className="mt-1 text-2xl font-bold leading-tight sm:text-4xl">
              {banner?.title ?? "Fresh bakery items, baked daily 🥐"}
            </h2>
            <p className="mt-2 text-sm opacity-90 sm:text-base">
              {banner?.tagline ?? "Order before 10 AM for same-day delivery"}
            </p>
          </div>
          {!banner?.imageUrl && (
            <span className="pointer-events-none absolute -right-6 -top-8 text-[9rem] opacity-20">
              🍩
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Menu</h1>
        <Input
          type="search"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Sticky category bar — jump to a category, plus repeat-last-order */}
      {categoryKeys.length > 0 && (
        <div className="sticky top-0 z-20 -mx-6 border-b bg-background/95 px-6 py-2 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-1 [&::-webkit-scrollbar]:hidden">
              {categoryKeys.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? "bg-foreground text-background"
                      : "hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {lastOrder && (
              <button
                onClick={handleRepeatLastOrder}
                title={`Repeat last order — ৳${lastOrder.totalAmount}`}
                className="flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted sm:self-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 2v6h6" />
                  <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
                </svg>
                Repeat last order · ৳{lastOrder.totalAmount}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stock-out warning after server 409 */}
      {unavailableWarning.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Stock out — removed from your cart: {unavailableWarning.join(", ")}.
          Please choose another.
          <button
            className="ml-2 underline"
            onClick={() => setUnavailableWarning([])}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* No search results */}
      {q && Object.keys(grouped).length === 0 && (
        <p className="text-muted-foreground text-sm">
          No items match "{search}".
        </p>
      )}

      {/* Menu categories — Foodpanda-style photo grid, 3 per row */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div
          key={category}
          ref={(el) => {
            sectionRefs.current[category] = el;
          }}
          data-category={category}
          className="scroll-mt-16 space-y-3"
        >
          <h2 className="text-lg font-semibold border-b pb-1">{category}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {catItems.map((item) => {
              const qty = cart[item.id]?.quantity ?? 0;
              const soldOut = !item.isAvailable || item.stockQuantity === 0;
              const lowStock =
                item.stockQuantity !== null &&
                item.stockQuantity > 0 &&
                item.stockQuantity <= 5;
              const atMax =
                item.stockQuantity !== null && qty >= item.stockQuantity;
              return (
                <div
                  key={item.id}
                  className={`card-light flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md ${soldOut ? "opacity-50" : ""}`}
                >
                  {/* Food photo — real upload if present, else a stock photo;
                      emoji shows through if the image fails to load. */}
                  <div
                    className={`relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${hashPick(
                      item.id,
                      GRADIENTS,
                    )}`}
                  >
                    <span className="text-4xl sm:text-5xl">
                      {foodEmoji(item.name)}
                    </span>
                    <img
                      src={item.imageUrl ?? foodImage(item.name)}
                      alt={item.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-0.5 p-2">
                    <span className="line-clamp-1 text-sm font-medium leading-tight">
                      {item.name}
                    </span>
                    <p className="line-clamp-1 flex-1 text-xs text-muted-foreground">
                      {hashPick(item.id, MOCK_TAGLINES)}
                    </p>
                    {soldOut ? (
                      <Badge
                        variant="destructive"
                        className="w-fit text-[10px]"
                      >
                        Stock Out
                      </Badge>
                    ) : item.stockQuantity !== null ? (
                      lowStock ? (
                        <Badge className="w-fit border-amber-400 bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100">
                          Only {item.stockQuantity} left
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="w-fit text-[10px]"
                        >
                          {item.stockQuantity} left
                        </Badge>
                      )
                    ) : null}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        ৳{item.price}
                      </span>
                      {!soldOut &&
                        (qty === 0 ? (
                          <button
                            className="h-8 rounded-md bg-foreground px-3 text-sm font-medium text-background transition-colors hover:opacity-90"
                            onClick={() =>
                              setQty(item.id, item.name, item.price, 1)
                            }
                            aria-label={`Add ${item.name}`}
                          >
                            Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-md border text-lg font-medium transition-colors hover:bg-muted"
                              onClick={() =>
                                setQty(
                                  item.id,
                                  item.name,
                                  item.price,
                                  Math.max(0, qty - 1),
                                )
                              }
                              aria-label={`Decrease ${item.name}`}
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-medium tabular-nums">
                              {qty}
                            </span>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-md border text-lg font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={atMax}
                              onClick={() =>
                                setQty(item.id, item.name, item.price, qty + 1)
                              }
                              aria-label={`Increase ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Spacer so the last row isn't hidden behind the floating cart bar */}
      {totalItems > 0 && <div aria-hidden className="h-24" />}

      {/* Floating cart bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-[4.5rem] left-4 right-4 z-10 flex items-stretch gap-2">
          <button
            onClick={handleClearCart}
            aria-label="Clear all items"
            title="Clear all items"
            className="flex items-center justify-center rounded-2xl border bg-card px-4 text-card-foreground shadow-xl transition-colors hover:bg-muted"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
          <button
            className="flex flex-1 items-center justify-between rounded-2xl bg-foreground px-6 py-4 text-base font-semibold text-background shadow-xl transition-transform active:scale-[0.99]"
            onClick={() => {
              setSuccessOrder(null);
              setConfirmOpen(true);
            }}
          >
            <span>
              {totalItems} item{totalItems !== 1 ? "s" : ""} &mdash; ৳
              {totalAmount}
            </span>
            <span>Place Order →</span>
          </button>
        </div>
      )}

      {/* Order confirmation sheet */}
      <Sheet
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setConfirmOpen(false);
            if (!successOrder) mutation.reset();
          }
        }}
      >
        <SheetContent
          side="bottom"
          // Flex column with a fixed header, a scrollable middle, and a pinned
          // footer button — so the action button is always on screen no matter
          // how many items are in the cart. `dvh` (not `vh`) accounts for the
          // mobile browser toolbar, which otherwise pushes the footer off-screen.
          className="flex max-h-[85dvh] flex-col"
          // Don't auto-focus the Note textarea on open — it pops the mobile
          // keyboard for an optional field. Keep focus on the sheet itself.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>
              {successOrder ? "Order Placed!" : "Confirm Order"}
            </SheetTitle>
          </SheetHeader>

          {successOrder ? (
            <>
              <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-4">
                {priceMismatch !== null && (
                  <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
                    Price updated by server: ৳{priceMismatch}
                  </div>
                )}
                <div className="rounded-md border bg-muted/50 p-4 text-center space-y-1">
                  <p className="text-lg font-semibold">
                    Order #
                    {successOrder.dailyNumber ?? successOrder.orderNumber}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      · today
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ref #{successOrder.orderNumber}
                  </p>
                  <p className="text-muted-foreground">
                    Total: ৳{successOrder.totalAmount}
                  </p>
                </div>
              </div>
              <div className="mt-4 shrink-0 border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
                <Button className="w-full" onClick={handleNewOrder}>
                  New Order
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Scrollable middle: cart items, total, note, error */}
              <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-4">
                <div className="divide-y rounded-md border overflow-hidden">
                  {Object.entries(cart).map(([id, entry]) => (
                    <div
                      key={id}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span className="font-medium">{entry.name}</span>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>×{entry.quantity}</span>
                        <span className="tabular-nums">
                          ৳{entry.price * entry.quantity}
                        </span>
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
                    {(mutation.error as Error & { status?: number })?.status ===
                    409
                      ? "Some items just went stock out and were removed from your cart. Please review and try again."
                      : "Failed to place order. Please try again."}
                  </div>
                )}
              </div>

              {/* Pinned footer — always visible, lifted clear of the screen's
                  bottom edge (safe-area inset + extra breathing room). */}
              <div className="mt-4 shrink-0 border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
                <Button
                  className="w-full"
                  onClick={handleConfirmOrder}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Placing order..." : "Confirm Order"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
