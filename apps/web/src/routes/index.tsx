import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  BookOpen,
  Radio,
  Wallet,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session: { role: string } | null };
    // Logged-in users go straight to their dashboard — behavior unchanged.
    if (session?.role === "admin") throw redirect({ to: "/admin" });
    if (session) throw redirect({ to: "/shop" });
    // Logged-out visitors see the public landing page (below) instead of being
    // bounced straight to the login box.
  },
  component: LandingPage,
});

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Order management",
    desc: "Shops place orders; staff accept, fulfil, or cancel with a full daily-numbered history.",
  },
  {
    icon: Radio,
    title: "Live order feed",
    desc: "New orders stream to the admin in real time over Server-Sent Events — no refresh.",
  },
  {
    icon: Wallet,
    title: "Khata credit ledger",
    desc: "Per-shop running balances with partial payments and carried-over dues, reconciled automatically.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Day/week/month sales, top shops, and fulfilment times at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    desc: "Admin, moderator, and shop roles — each sees only what it should, enforced server-side.",
  },
  {
    icon: BookOpen,
    title: "Menu & stock control",
    desc: "Categories, combos, image uploads, stock tracking, and visibility toggles.",
  },
];

const STACK = [
  "React 19",
  "TanStack Router + Query",
  "Hono (typed RPC)",
  "Better Auth",
  "PostgreSQL",
  "Drizzle ORM",
  "Tailwind CSS v4",
  "Bun",
  "Railway / Docker",
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-xl font-bold tracking-tight">Tamurfood</span>
        <Button asChild size="sm">
          <Link to="/login">Log in</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-24">
        <span className="inline-block rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          B2B ordering platform
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          Ordering &amp; credit, done right for local wholesale
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Tamurfood lets a supplier take orders from many shops, fulfil them
          live, and track every shop&apos;s dues in a built-in{" "}
          <span className="font-medium text-foreground">Khata</span> ledger —
          replacing the paper credit book and phone-call ordering.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/login">Log in to continue</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Access is invite-only — accounts are created by the administrator.
        </p>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">What it does</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border bg-background p-5 text-left"
              >
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">Built with</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A modern, type-safe, full-stack TypeScript monorepo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {STACK.map((t) => (
              <span
                key={t}
                className="rounded-full border bg-muted/40 px-3 py-1 text-sm"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        <p>Tamurfood — B2B bakery ordering &amp; Khata ledger.</p>
        <Link to="/login" className="mt-2 inline-block underline">
          Log in
        </Link>
      </footer>
    </div>
  );
}
