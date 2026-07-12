import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@tanstack/react-router";
import type { SessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session: SessionUser | null };
    if (!session || session.role !== "admin") {
      throw redirect({ to: "/shop" });
    }
    return { session };
  },
  component: AdminLayout,
});

const NAV_ITEMS = [
  { label: "Orders", to: "/admin" as const },
  { label: "Menu", to: "/admin/menu" as const },
  { label: "Shops", to: "/admin/shops" as const },
  { label: "Payments", to: "/admin/payments" as const },
  { label: "Khata", to: "/admin/khata" as const },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          activeProps={{
            className:
              "px-3 py-2 rounded-md text-sm font-medium bg-accent text-foreground",
          }}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function AdminLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

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
              <NavLinks onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Tamurfood Admin</span>
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
          <NavLinks />
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
