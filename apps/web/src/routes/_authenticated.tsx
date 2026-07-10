import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import type { SessionUser } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session: SessionUser | null };
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: () => <Outlet />,
});
