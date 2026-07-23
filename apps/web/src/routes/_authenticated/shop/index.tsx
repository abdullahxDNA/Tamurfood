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

function foodMatch(name: string) {
  const n = name.toLowerCase();
  return FOOD_MAP.find((f) => f.keywords.some((k) => n.includes(k)));
}

function foodEmoji(name: string): string {
  return foodMatch(name)?.emoji ?? "🍽️";
}

const GRADIENTS = [
  "from-amber-100 to-orange-200",
  "from-rose-100 to-red-200",
  "from-lime-100 to-green-200",
  "from-sky-100 to-blue-200",
  "from-violet-100 to-purple-200",
  "from-yellow-100 to-amber-200",
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
        // Reset any stale mismatch from a prior order, otherwise its banner can
        // reappear on this order's success screen (sheet dismissed via outside
        // tap doesn't clear it — only the "New Order" button does).
        setPriceMismatch(null);
      }
      try {
        const raw = localStorage.getItem("shop-new-orders");
        const ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
        ids.add(data.id);
        localStorage.setItem("shop-new-orders", JSON.stringify([...ids]));
      } catch {
        /* ignore */
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

  // Radix locks interaction by setting `pointer-events: none` on <body> while a
  // Sheet/Dialog is open, and on touch devices it can linger for a beat after
  // close — swallowing the next tap (e.g. the first tap on the bottom nav after
  // placing an order). Clear it once the confirmation sheet is closed.
  useEffect(() => {
    if (confirmOpen) return;
    const t = setTimeout(() => {
      document.body.style.pointerEvents = "";
    }, 150);
    return () => clearTimeout(t);
  }, [confirmOpen]);

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

  // Highlight the category currently in view (scroll-spy). Recompute from the
  // sections' LIVE positions on every scroll so it stays correct in BOTH
  // directions — a prior IntersectionObserver only reacted to sections whose
  // visibility *changed*, so scrolling back up (where the newly-active section
  // was already visible and fired nothing) failed to update the highlight.
  // The active category is the last section whose top has scrolled up past the
  // sticky bar (rAF-throttled so it stays cheap).
  useEffect(() => {
    const cats = categoryKey ? categoryKey.split("|") : [];
    if (cats.length === 0) return;

    let raf = 0;
    const compute = () => {
      raf = 0;
      const line = 120; // just below the sticky category bar
      let current = cats[0];
      for (const cat of cats) {
        const el = sectionRefs.current[cat];
        if (el && el.getBoundingClientRect().top <= line) current = cat;
      }
      setActiveCategory(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };

    compute(); // set initial highlight
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [categoryKey]);

  if (isLoading) {
    // Skeleton mirrors the real layout (full-width banner + category chips +
    // card grid) so when the data arrives the content swaps in place instead
    // of shifting everything down (keeps CLS low).
    return (
      <div className="space-y-6">
        <div className="relative left-1/2 -mt-6 h-[200px] w-screen -translate-x-1/2 animate-pulse bg-muted sm:h-[260px]" />
        <div className="flex gap-2">
          <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800/80"
            >
              <div className="aspect-[4/3] animate-pulse bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
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
          className="relative left-1/2 -mt-6 flex min-h-[200px] w-screen -translate-x-1/2 items-center overflow-hidden bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm sm:min-h-[260px]"
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
        <div className="sticky top-[3.75rem] z-20 -mx-4 sm:-mx-6 border-b border-stone-200/60 dark:border-stone-800/60 bg-white/90 dark:bg-stone-950/90 px-4 sm:px-6 py-2.5 backdrop-blur-md">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-1 [&::-webkit-scrollbar]:hidden">
              {categoryKeys.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeCategory === cat
                      ? "bg-amber-700 text-white shadow-xs dark:bg-amber-600"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200/80 dark:bg-stone-900 dark:text-stone-400 dark:hover:bg-stone-800"
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
                className="flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full border border-amber-600/30 bg-amber-600/10 px-3.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 transition-all hover:bg-amber-600/20 sm:self-auto shadow-xs"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
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
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400 font-medium">
          Stock out — removed from your cart: {unavailableWarning.join(", ")}.
          Please choose another.
          <button
            className="ml-2 underline font-semibold"
            onClick={() => setUnavailableWarning([])}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* No search results */}
      {q && Object.keys(grouped).length === 0 && (
        <p className="text-stone-500 text-xs py-8 text-center">
          No items match "{search}".
        </p>
      )}

      {/* Menu categories — Foodpanda/Toast style photo grid */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div
          key={category}
          ref={(el) => {
            sectionRefs.current[category] = el;
          }}
          data-category={category}
          className="scroll-mt-24 space-y-3.5"
        >
          <div className="flex items-center gap-2 border-b border-stone-200/60 dark:border-stone-800/60 pb-2">
            <h2 className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-100">
              {category}
            </h2>
            <span className="text-xs text-stone-400 font-mono">
              ({catItems.length})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900 transition-all hover:shadow-lg hover:-translate-y-0.5 ${soldOut ? "opacity-60 grayscale-[30%]" : ""}`}
                >
                  {/* Food photo */}
                  <div
                    className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br ${hashPick(
                      item.id,
                      GRADIENTS,
                    )}`}
                  >
                    <span className="text-4xl sm:text-5xl transition-transform group-hover:scale-110">
                      {foodEmoji(item.name)}
                    </span>
                    {/* Only load an image when the admin has uploaded a real
                        photo. Otherwise show the instant emoji + gradient so we
                        don't fetch a remote stock photo per card (that was 16
                        third-party requests, tanking LCP and causing layout
                        shift). Uploaded photos appear here automatically. */}
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-xs font-bold text-stone-900 dark:text-stone-100">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-sm font-extrabold text-[#c15f3c] dark:text-amber-400">
                        ৳{item.price}
                      </span>
                    </div>
                    <div className="min-h-5 mt-0.5">
                      {soldOut ? (
                        <Badge
                          variant="destructive"
                          className="w-fit text-[9px] px-1.5 py-0 font-semibold"
                        >
                          Stock Out
                        </Badge>
                      ) : item.stockQuantity !== null ? (
                        lowStock ? (
                          <Badge className="w-fit border-amber-400 bg-amber-100 text-[9px] font-semibold text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300">
                            Only {item.stockQuantity} left
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] px-1.5 py-0 text-stone-500"
                          >
                            {item.stockQuantity} in stock
                          </Badge>
                        )
                      ) : null}
                    </div>

                    <div className="mt-auto pt-2 flex items-center justify-end">
                      {!soldOut &&
                        (qty === 0 ? (
                          <button
                            className="h-7 rounded-lg bg-stone-900 dark:bg-stone-100 px-3 text-xs font-bold text-white dark:text-stone-900 shadow-xs transition-all hover:brightness-110 active:scale-95"
                            onClick={() =>
                              setQty(item.id, item.name, item.price, 1)
                            }
                            aria-label={`Add ${item.name}`}
                          >
                            + Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-800/60 p-1">
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold leading-none hover:bg-white dark:hover:bg-stone-700 transition-colors active:scale-95"
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
                            <span className="w-6 text-center text-sm font-bold tabular-nums">
                              {qty}
                            </span>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold leading-none hover:bg-white dark:hover:bg-stone-700 transition-colors active:scale-95 disabled:opacity-40"
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

      {/* Floating cart bar — sits in a soft grayish glass tray so it reads as one
          grounded panel against the light background instead of loose buttons. */}
      {totalItems > 0 && (
        <div className="fixed bottom-[4.75rem] left-4 right-4 z-40 mx-auto flex max-w-lg items-stretch gap-2 rounded-[1.4rem] border border-stone-300/70 bg-stone-200/80 p-1.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.28)] backdrop-blur-xl dark:border-stone-700/60 dark:bg-stone-800/85">
          <button
            onClick={handleClearCart}
            aria-label="Clear all items"
            title="Clear all items"
            className="flex items-center justify-center rounded-[1.05rem] border border-stone-300/80 bg-white text-stone-500 shadow-sm dark:bg-stone-900 dark:border-stone-700 dark:text-stone-300 transition-all hover:text-red-600 hover:border-red-200 dark:hover:bg-stone-800 active:scale-95 px-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
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
            className="flex flex-1 items-center justify-between rounded-[1.05rem] text-white shadow-sm shadow-amber-900/20 px-5 py-3.5 text-sm font-bold transition-all hover:brightness-105 active:scale-[0.99] border border-amber-800/20"
            style={{ backgroundColor: "#c15f3c" }}
            onClick={() => {
              setSuccessOrder(null);
              setConfirmOpen(true);
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#c15f3c] text-xs font-black shadow-xs">
                {totalItems}
              </span>
              <span className="text-white font-extrabold tracking-tight">
                Total: ৳{totalAmount}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-amber-100 font-extrabold group-hover:translate-x-0.5 transition-transform">
              Place Order →
            </span>
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
          className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-950 p-0 overflow-hidden shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="shrink-0 border-b border-stone-100 dark:border-stone-800 px-6 py-4">
            <SheetTitle className="text-base font-bold font-serif text-stone-900 dark:text-stone-100">
              {successOrder
                ? "🎉 Order Placed Successfully!"
                : "Confirm Your Order"}
            </SheetTitle>
          </SheetHeader>

          {successOrder ? (
            <>
              <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-6">
                {priceMismatch !== null && (
                  <div className="rounded-xl border border-blue-300 bg-blue-50/80 p-3 text-xs font-medium text-blue-800">
                    Price updated by server: ৳{priceMismatch}
                  </div>
                )}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-1.5">
                  <span className="inline-block text-2xl">⚡</span>
                  <p className="text-xl font-extrabold text-stone-900 dark:text-stone-100">
                    Order #
                    {successOrder.dailyNumber ?? successOrder.orderNumber}
                    <span className="text-xs font-normal text-stone-500">
                      {" "}
                      · today
                    </span>
                  </p>
                  <p className="text-xs text-stone-400 font-mono">
                    Ref #{successOrder.orderNumber}
                  </p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                    Total Amount: ৳{successOrder.totalAmount}
                  </p>
                </div>
              </div>
              <div className="mt-4 shrink-0 border-t border-stone-100 dark:border-stone-800 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
                <Button
                  className="w-full rounded-xl py-3 font-bold text-white shadow-md transition-all hover:brightness-105"
                  style={{ backgroundColor: "#c15f3c" }}
                  onClick={handleNewOrder}
                >
                  New Order
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Scrollable middle: cart items, total, note, error */}
              <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-6">
                <div className="divide-y divide-stone-100 dark:divide-stone-800 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 overflow-hidden">
                  {Object.entries(cart).map(([id, entry]) => {
                    // Respect the item's remaining stock when adjusting from the
                    // cart, same as the menu card (server also re-checks on order).
                    const stock =
                      items.find((i) => i.id === id)?.stockQuantity ?? null;
                    const atMax = stock !== null && entry.quantity >= stock;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold text-stone-800 dark:text-stone-200">
                          {entry.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-0.5">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-bold leading-none transition-colors hover:bg-stone-100 dark:hover:bg-stone-700 active:scale-95"
                              onClick={() => {
                                setQty(
                                  id,
                                  entry.name,
                                  entry.price,
                                  Math.max(0, entry.quantity - 1),
                                );
                                // Removing the last unit of the last item empties
                                // the cart — close the sheet, nothing to order.
                                if (totalItems === 1) setConfirmOpen(false);
                              }}
                              aria-label={`Decrease ${entry.name}`}
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-bold tabular-nums">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={atMax}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-bold leading-none transition-colors hover:bg-stone-100 dark:hover:bg-stone-700 active:scale-95 disabled:opacity-40"
                              onClick={() =>
                                setQty(
                                  id,
                                  entry.name,
                                  entry.price,
                                  entry.quantity + 1,
                                )
                              }
                              aria-label={`Increase ${entry.name}`}
                            >
                              +
                            </button>
                          </div>
                          <span className="w-14 text-right tabular-nums font-bold text-stone-900 dark:text-stone-100">
                            ৳{entry.price * entry.quantity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between font-bold text-sm px-1 text-stone-900 dark:text-stone-100 pt-1">
                  <span>Grand Total</span>
                  <span className="text-base text-amber-700 dark:text-amber-500 font-mono font-extrabold">
                    ৳{totalAmount}
                  </span>
                </div>

                <Textarea
                  placeholder="Order Note (optional - e.g. extra napkins, deliver to 2nd floor counter)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="rounded-xl border-stone-200 dark:border-stone-800 text-xs bg-stone-50/50 dark:bg-stone-900/50"
                />

                {mutation.isError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 font-medium">
                    {(mutation.error as Error & { status?: number })?.status ===
                    409
                      ? "Some items just went stock out and were removed from your cart. Please review and try again."
                      : "Failed to place order. Please try again."}
                  </div>
                )}
              </div>

              {/* Pinned footer */}
              <div className="mt-4 shrink-0 border-t border-stone-100 dark:border-stone-800 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
                <Button
                  className="w-full rounded-xl py-3 font-bold text-white shadow-lg shadow-amber-900/15 transition-all hover:brightness-105 active:scale-[0.99]"
                  style={{ backgroundColor: "#c15f3c" }}
                  onClick={handleConfirmOrder}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? "Placing Order..."
                    : "Confirm & Send Order"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
