import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  BookOpen,
  Radio,
  Wallet,
  BarChart3,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

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
    desc: "New orders stream to the admin in real time over Server-Sent Events — no refresh needed.",
  },
  {
    icon: Wallet,
    title: "Khata credit ledger",
    desc: "Per-shop running balances with partial payments and carried-over dues, reconciled automatically.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Day, week and month sales, top shops, and fulfilment times at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    desc: "Admin, moderator and shop roles — each sees only what it should, enforced server-side.",
  },
  {
    icon: BookOpen,
    title: "Menu & stock control",
    desc: "Categories, combos, image uploads, live stock tracking, and visibility toggles.",
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
  "Railway · Docker",
];

const STATS = [
  { value: "3", label: "user roles" },
  { value: "SSE", label: "live orders" },
  { value: "Khata", label: "credit ledger" },
  { value: "100%", label: "TypeScript" },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ───────── Hero (dark, dramatic) ───────── */}
      <div className="relative overflow-hidden bg-zinc-950 text-white">
        {/* soft colour glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-rose-500/10 blur-[120px]"
        />
        {/* subtle dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* nav */}
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-black text-zinc-950">
              T
            </span>
            Tamurfood
          </span>
          <Link
            to="/login"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/10"
          >
            Log in
          </Link>
        </header>

        {/* hero content */}
        <section className="relative mx-auto max-w-3xl px-6 pb-24 pt-12 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-amber-200 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            B2B ordering &amp; credit platform
          </span>

          <h1 className="mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Ordering &amp; credit,
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              done right for wholesale
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">
            Tamurfood lets a supplier take orders from many shops, fulfil them
            live, and track every shop&apos;s dues in a built-in{" "}
            <span className="font-semibold text-white">Khata</span> ledger —
            replacing the paper credit book and phone-call ordering.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-7 py-3 font-semibold text-zinc-950 shadow-lg shadow-orange-500/25 transition hover:shadow-orange-500/40"
            >
              Log in to continue
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Invite-only — accounts are created by the administrator.
          </p>

          {/* stat strip */}
          <div className="mx-auto mt-14 grid max-w-lg grid-cols-4 gap-4 border-t border-white/10 pt-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-xl font-bold text-white sm:text-2xl">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ───────── Product showcase ───────── */}
      <section className="bg-white px-6 pb-8 pt-20 sm:pt-24">
        <div className="mx-auto max-w-5xl">
          <div className="relative">
            {/* desktop browser frame — admin dashboard */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-2xl shadow-zinc-900/10">
              <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-zinc-400">
                  Admin · live orders &amp; analytics
                </span>
              </div>
              <img
                src="/screenshots/admin-dashboard.png"
                alt="Admin dashboard with the live order feed and analytics"
                className="w-full"
                loading="lazy"
              />
            </div>
            {/* floating phone — live order-placing GIF */}
            <div className="absolute -bottom-10 -right-2 hidden w-36 overflow-hidden rounded-[2rem] border-[6px] border-zinc-900 bg-zinc-900 shadow-2xl md:block lg:w-44">
              <img
                src="/screenshots/demo.gif"
                alt="Placing an order on the shop side"
                className="w-full rounded-[1.5rem]"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a wholesale supplier needs
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-500">
            One platform for orders, fulfilment, and the money in between.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-zinc-200 bg-white p-6 transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/5"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-orange-600 transition group-hover:from-amber-400 group-hover:to-orange-500 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Mobile screens ───────── */}
      <section className="border-t border-zinc-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the shop floor
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-500">
              Shops order, track, and check their balance — all from a phone.
            </p>
          </div>
          <div className="mt-12 flex flex-wrap items-start justify-center gap-6 sm:gap-8">
            {[
              { src: "/screenshots/shop-menu.png", label: "Menu & ordering" },
              { src: "/screenshots/order-tracker.png", label: "Order tracker" },
              { src: "/screenshots/khata.png", label: "Khata balance" },
            ].map((s) => (
              <figure key={s.src} className="w-40 sm:w-48">
                <div className="overflow-hidden rounded-[2rem] border-[6px] border-zinc-900 bg-zinc-900 shadow-xl transition hover:-translate-y-1">
                  <img
                    src={s.src}
                    alt={s.label}
                    className="w-full rounded-[1.5rem]"
                    loading="lazy"
                  />
                </div>
                <figcaption className="mt-3 text-center text-sm font-medium text-zinc-500">
                  {s.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Tech stack ───────── */}
      <section className="border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built with a modern stack
          </h2>
          <p className="mt-3 text-zinc-500">
            A type-safe, full-stack TypeScript monorepo — end to end.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            {STACK.map((t) => (
              <span
                key={t}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-amber-300 hover:text-amber-700"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA + footer ───────── */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/15 blur-[100px]"
        />
        <div className="relative mx-auto max-w-2xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">
            Log in with the account created for you by the administrator.
          </p>
          <Link
            to="/login"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-7 py-3 font-semibold text-zinc-950 shadow-lg shadow-orange-500/25 transition hover:shadow-orange-500/40"
          >
            Log in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <div className="mt-14 border-t border-white/10 pt-8 text-sm text-zinc-500">
            Tamurfood — B2B bakery ordering &amp; Khata ledger.
          </div>
        </div>
      </section>
    </div>
  );
}
