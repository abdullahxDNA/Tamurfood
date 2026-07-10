import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session: { role: string } | null };
    if (!session) {
      throw redirect({ to: "/login" });
    }
    if (session.role === "admin") {
      throw redirect({ to: "/admin" });
    }
    throw redirect({ to: "/shop" });
  },
  component: () => null,
});
