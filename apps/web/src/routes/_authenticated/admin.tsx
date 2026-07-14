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
import { Menu } from "lucide-react";
import { api } from "@/lib/api";

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
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-between"
          activeProps={{
            className:
              "px-3 py-2 rounded-md text-sm font-medium bg-accent text-foreground flex items-center justify-between",
          }}
          onClick={onNavigate}
        >
          <span>{item.label}</span>
          {item.to === "/admin/menu" && pendingCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
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
  const { session } = Route.useRouteContext();
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
    <div className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 pt-10">
              <NavLinks
                items={navItems}
                pendingCount={pendingCount}
                onNavigate={() => setSheetOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">
            Tamurfood {isAdmin ? "Admin" : "Staff"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/profile"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Change Password
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 border-r flex-col p-4 sticky top-0 h-[calc(100vh-3.5rem)]">
          <NavLinks items={navItems} pendingCount={pendingCount} />
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
