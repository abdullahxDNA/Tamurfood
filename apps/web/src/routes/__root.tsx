import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { sessionQueryOptions, type SessionUser } from "@/lib/session";
import { Toaster } from "sonner";

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient
      .fetchQuery(sessionQueryOptions)
      .catch(() => null);
    return { session: session as SessionUser | null };
  },
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <Toaster richColors />
    </div>
  ),
});
