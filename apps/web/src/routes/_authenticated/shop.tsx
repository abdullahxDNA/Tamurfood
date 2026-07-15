import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useRouter,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import type { SessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { CartProvider } from "@/lib/cart-context";
import { useTheme } from "@/lib/theme";

// Per-device unread counters for the bottom-nav notification badges. They
// increment on live SSE events while the shop is away from that tab, and reset
// to 0 when the shop opens it.
const ORDERS_SEEN_KEY = "shop-unseen-orders";
const KHATA_SEEN_KEY = "shop-unseen-khata";
// IDs of items that changed while the shop was away from that tab. The tab's
// page reads these on open to flash a "NEW" marker on the affected rows — for
// Orders these are order IDs, for Khata they are ledger-row IDs (order or
// payment IDs). They persist until the tab is opened (never expire while away).
const NEW_ORDERS_KEY = "shop-new-orders";
const NEW_KHATA_KEY = "shop-new-khata";

function loadCount(key: string): number {
  if (typeof localStorage === "undefined") return 0;
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function stashNewId(key: string, id: string) {
  try {
    const raw = localStorage.getItem(key);
    const ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    ids.add(id);
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

// Small red count badge shown over a nav icon.
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/shop")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session: SessionUser | null };
    if (!session || session.role !== "shop") {
      throw redirect({ to: "/admin" });
    }
    return { session };
  },
  component: ShopLayout,
});

function ShopLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = Route.useRouteContext();
  const { theme, toggleTheme } = useTheme();

  // ── Notification badges ──────────────────────────────────────────────────
  const pathname = useLocation({ select: (l) => l.pathname });
  const [ordersUnseen, setOrdersUnseen] = useState(() =>
    loadCount(ORDERS_SEEN_KEY),
  );
  const [khataUnseen, setKhataUnseen] = useState(() =>
    loadCount(KHATA_SEEN_KEY),
  );

  // Keep the current path readable inside the SSE callbacks below.
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Persist the counters so badges survive a refresh.
  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_SEEN_KEY, String(ordersUnseen));
    } catch {
      /* ignore */
    }
  }, [ordersUnseen]);
  useEffect(() => {
    try {
      localStorage.setItem(KHATA_SEEN_KEY, String(khataUnseen));
    } catch {
      /* ignore */
    }
  }, [khataUnseen]);

  // Opening a tab clears its badge. Track the previous path in state and adjust
  // during render (guarded to avoid loops) — React's documented pattern for
  // "adjusting state when a prop changes".
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (pathname.startsWith("/shop/orders") && ordersUnseen !== 0)
      setOrdersUnseen(0);
    if (pathname.startsWith("/shop/khata") && khataUnseen !== 0)
      setKhataUnseen(0);
  }

  // Live badge updates: bump the count when an event arrives for a tab the shop
  // isn't currently looking at. Same per-shop SSE feed the order tracker uses.
  useEffect(() => {
    const source = new EventSource("/api/v1/orders/stream");
    source.addEventListener("order_status", (e) => {
      let status: string | undefined;
      let orderId: string | undefined;
      try {
        const p = JSON.parse((e as MessageEvent).data) as {
          status?: string;
          orderId?: string;
        };
        status = p.status;
        orderId = p.orderId;
      } catch {
        /* ignore malformed payload */
      }
      if (!pathRef.current.startsWith("/shop/orders")) {
        setOrdersUnseen((n) => n + 1);
        // Remember it so the Orders page can flash a "NEW" marker when opened.
        if (orderId) stashNewId(NEW_ORDERS_KEY, orderId);
      }
      // An accepted order adds a debit to the khata (the shop now owes more), so
      // the Khata tab has something new too — its ledger row's id is the order id.
      // A cancellation doesn't change the khata.
      if (status === "accepted" && !pathRef.current.startsWith("/shop/khata")) {
        setKhataUnseen((n) => n + 1);
        if (orderId) stashNewId(NEW_KHATA_KEY, orderId);
      }
    });
    source.addEventListener("payment_recorded", (e) => {
      let paymentId: string | undefined;
      try {
        paymentId = (
          JSON.parse((e as MessageEvent).data) as {
            paymentId?: string;
          }
        ).paymentId;
      } catch {
        /* ignore malformed payload */
      }
      if (!pathRef.current.startsWith("/shop/khata")) {
        setKhataUnseen((n) => n + 1);
        if (paymentId) stashNewId(NEW_KHATA_KEY, paymentId);
      }
    });
    return () => source.close();
  }, []);

  async function handleLogout() {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    router.navigate({ to: "/login" });
  }

  return (
    <CartProvider>
      <div className="min-h-screen overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <header className="border-b px-6 py-4 flex items-center justify-between gap-3">
          <span className="text-lg font-extrabold tracking-tight whitespace-nowrap">
            তামুরফুড <span className="text-muted-foreground">·</span> Tamurfood
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[10rem]">
              {session.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl p-6">
          <Outlet />
        </main>
        {/* Bottom navigation */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 box-content flex h-16 border-t bg-background pb-[env(safe-area-inset-bottom)]"
        >
          <Link
            to="/shop"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors select-none active:bg-muted/50"
            activeProps={{ className: "text-primary", "aria-current": "page" }}
            inactiveProps={{ className: "text-muted-foreground" }}
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
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Menu
          </Link>
          <Link
            to="/shop/orders"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors select-none active:bg-muted/50"
            activeProps={{ className: "text-primary", "aria-current": "page" }}
            inactiveProps={{ className: "text-muted-foreground" }}
          >
            <span className="relative">
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <NavBadge count={ordersUnseen} />
            </span>
            Orders
          </Link>
          <Link
            to="/shop/khata"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors select-none active:bg-muted/50"
            activeProps={{ className: "text-primary", "aria-current": "page" }}
            inactiveProps={{ className: "text-muted-foreground" }}
          >
            <span className="relative">
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
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <NavBadge count={khataUnseen} />
            </span>
            Khata
          </Link>
          <Link
            to="/shop/profile"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors select-none active:bg-muted/50"
            activeProps={{ className: "text-primary", "aria-current": "page" }}
            inactiveProps={{ className: "text-muted-foreground" }}
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
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile
          </Link>
        </nav>
      </div>
    </CartProvider>
  );
}
