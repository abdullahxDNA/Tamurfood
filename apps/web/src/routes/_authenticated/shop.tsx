import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@tanstack/react-router";
import type { SessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { CartProvider } from "@/lib/cart-context";
import { useTheme } from "@/lib/theme";

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

  async function handleLogout() {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    router.navigate({ to: "/login" });
  }

  return (
    <CartProvider>
      <div className="min-h-screen pb-16">
        <header className="border-b px-6 py-4 flex items-center justify-between">
          <span className="font-semibold truncate min-w-0 mr-4">
            {session.name}
          </span>
          <div className="flex items-center gap-2">
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
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background flex h-16">
          <Link
            to="/shop"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
            activeProps={{ className: "text-foreground" }}
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
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
            activeProps={{ className: "text-foreground" }}
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Orders
          </Link>
          <Link
            to="/shop/khata"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
            activeProps={{ className: "text-foreground" }}
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
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Khata
          </Link>
          <Link
            to="/shop/profile"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
            activeProps={{ className: "text-foreground" }}
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
