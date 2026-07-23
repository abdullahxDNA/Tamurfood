import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@tanstack/react-router";
import type { SessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Menu } from "lucide-react";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session: SessionUser | null };
    if (
      !session ||
      (session.role !== "admin" && session.role !== "moderator")
    ) {
      throw redirect({ to: "/shop" });
    }
    return { session };
  },
  component: AdminLayout,
});

const ADMIN_NAV = [
  { label: "Orders", to: "/admin" as const },
  { label: "Menu", to: "/admin/menu" as const },
  { label: "Moderators", to: "/admin/moderators" as const },
  { label: "Shops", to: "/admin/shops" as const },
  { label: "Payments", to: "/admin/payments" as const },
  { label: "Khata", to: "/admin/khata" as const },
  { label: "Banner", to: "/admin/banner" as const },
];

const MODERATOR_NAV = [
  { label: "Orders", to: "/admin" as const },
  { label: "Menu", to: "/admin/menu" as const },
  { label: "My Requests", to: "/admin/requests" as const },
];

function NavLinks({
  items,
  pendingCount,
  onNavigate,
}: {
  items: { label: string; to: string }[];
  pendingCount: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1.5">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/80 dark:hover:bg-stone-800/60 transition-all flex items-center justify-between group"
          activeProps={{
            className:
              "px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-amber-600/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 flex items-center justify-between border border-amber-600/20 shadow-xs",
          }}
          onClick={onNavigate}
        >
          <span>{item.label}</span>
          {item.to === "/admin/menu" && pendingCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[10px] font-bold text-white shadow-xs animate-pulse">
              {pendingCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

function AdminLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { session } = Route.useRouteContext();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = session.role === "admin";

  const { data: pendingData } = useQuery({
    queryKey: ["pending-changes-count"],
    queryFn: async () => {
      const res = await api.api.v1.admin["pending-changes"].count.$get();
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const pendingCount = isAdmin ? (pendingData?.count ?? 0) : 0;
  const navItems = isAdmin ? ADMIN_NAV : MODERATOR_NAV;

  async function handleLogout() {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f5]/40 dark:bg-stone-950/40 text-stone-900 dark:text-stone-100">
      {/* Top Glass Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 dark:bg-stone-950/85 border-b border-stone-200/60 dark:border-stone-800/60 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 rounded-xl"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 pt-10 border-stone-200/80 dark:border-stone-800"
            >
              <div className="mb-6 px-3 flex items-center gap-2">
                <span
                  className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: "#c15f3c" }}
                >
                  T
                </span>
                <span className="font-serif font-semibold text-base">
                  Tamurfood {isAdmin ? "Admin" : "Staff"}
                </span>
              </div>
              <NavLinks
                items={navItems}
                pendingCount={pendingCount}
                onNavigate={() => setSheetOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <Link to="/admin" className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center rounded-xl text-xs font-bold text-white shadow-xs"
              style={{ backgroundColor: "#c15f3c" }}
            >
              T
            </span>
            <span className="font-serif font-bold text-base tracking-tight hidden sm:inline-block">
              Tamurfood{" "}
              <span className="font-sans font-medium text-xs text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md ml-1 border border-stone-200/50 dark:border-stone-700/50">
                {isAdmin ? "Admin Console" : "Staff Portal"}
              </span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/profile"
            className="text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors hidden sm:inline-block"
          >
            Password
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-8 w-8 p-0 rounded-lg"
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmLogout(true)}
            className="h-8 text-xs rounded-xl border-stone-200/80 dark:border-stone-800"
          >
            Logout
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 border-r border-stone-200/60 dark:border-stone-800/60 bg-white/40 dark:bg-stone-950/40 flex-col p-4 sticky top-[3.5rem] h-[calc(100vh-3.5rem)]">
          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Navigation
          </div>
          <NavLinks items={navItems} pendingCount={pendingCount} />
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Confirm before logging out. */}
      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You&apos;ll need to sign in again to manage orders.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogout(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
