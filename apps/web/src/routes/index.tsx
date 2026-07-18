import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShoppingCart,
  BookOpen,
  Radio,
  Wallet,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Check,
  Moon,
  Sun,
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

// Warm clay accent (Anthropic/Claude-like), used for CTAs and highlights.
const CLAY = "#c15f3c";

type Feature = {
  icon: typeof ShoppingCart;
  title: string;
  summary: string;
  points: string[];
  img: string | null;
  phone?: boolean;
};

const FEATURES: Feature[] = [
  {
    icon: ShoppingCart,
    title: "Order management",
    summary: "Shops place orders; staff accept, fulfil, or cancel them.",
    points: [
      "A daily-numbered order history for every shop",
      "Accept, mark done, or cancel with a reason the shop sees",
      "Atomic stock decrement — you can never oversell the last units",
    ],
    img: "/screenshots/order-tracker.png",
    phone: true,
  },
  {
    icon: Radio,
    title: "Live order feed",
    summary: "New orders reach the admin the instant they're placed.",
    points: [
      "Real-time updates over Server-Sent Events",
      "No polling, no manual refresh",
      "The admin sees each order the moment it lands",
    ],
    img: "/screenshots/admin-dashboard.png",
    phone: false,
  },
  {
    icon: Wallet,
    title: "Khata ledger",
    summary: "Every shop's running credit balance, tracked automatically.",
    points: [
      "Partial payments and carried-over dues",
      "Auto-reconciled against the shop's payment pool",
      "Both sides see the same balance — no disputes",
    ],
    img: "/screenshots/khata.png",
    phone: true,
  },
  {
    icon: BarChart3,
    title: "Analytics",
    summary: "Understand sales and performance at a glance.",
    points: [
      "Day, week and month revenue",
      "Top shops by spend",
      "Average order-fulfilment time",
    ],
    img: "/screenshots/admin-dashboard.png",
    phone: false,
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    summary: "Admin, moderator and shop roles — enforced on the server.",
    points: [
      "Moderators run day-to-day; menu edits need admin approval",
      "Shops only ever see their own data",
      "Deactivated accounts are blocked instantly",
    ],
    img: null,
  },
  {
    icon: BookOpen,
    title: "Menu & stock",
    summary: "Full control over what shops can order.",
    points: [
      "Categories, combos and image uploads",
      "Live stock tracking with automatic stock-out",
      "Hide items instantly with a visibility toggle",
    ],
    img: "/screenshots/shop-menu.png",
    phone: true,
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

const PHONES = [
  { src: "/screenshots/shop-menu.png", label: "Menu & ordering" },
  { src: "/screenshots/order-tracker.png", label: "Order tracker" },
  { src: "/screenshots/khata.png", label: "Khata balance" },
];

function LandingPage() {
  // Dark mode is scoped to THIS page only via the `dark` class on the root div,
  // so the login/admin/shop pages are completely unaffected.
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-[#faf9f5] text-stone-800 antialiased dark:bg-stone-950 dark:text-stone-300">
        {/* ───────── Nav ───────── */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="flex items-center gap-2.5 font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: CLAY }}
            >
              T
            </span>
            Tamurfood
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle dark mode"
              className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-stone-600 transition hover:text-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:text-stone-100"
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <Link
              to="/login"
              className="text-sm font-medium text-stone-600 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            >
              Log in →
            </Link>
          </div>
        </header>

        {/* ───────── Hero ───────── */}
        <section className="mx-auto max-w-3xl px-6 pt-16 text-center sm:pt-24">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium"
            style={{
              borderColor: `${CLAY}33`,
              backgroundColor: `${CLAY}0f`,
              color: CLAY,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: CLAY }}
            />
            B2B ordering &amp; credit platform
          </span>

          <h1 className="mt-8 font-serif text-5xl font-medium leading-[1.05] tracking-tight text-stone-900 dark:text-stone-50 sm:text-6xl">
            Ordering &amp; credit,
            <br />
            done right for wholesale.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400">
            Tamurfood lets a supplier take orders from many shops, fulfil them
            live, and track every shop&apos;s dues in a built-in{" "}
            <span className="font-medium text-stone-900 dark:text-stone-100">
              Khata
            </span>{" "}
            ledger — replacing the paper credit book and phone-call ordering.
          </p>

          <div className="mt-9 flex items-center justify-center">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-medium text-white shadow-sm transition hover:brightness-95"
              style={{ backgroundColor: CLAY }}
            >
              Log in to continue
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
            Invite-only — accounts are created by the administrator.
          </p>
        </section>

        {/* ───────── Product showcase ───────── */}
        <section className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-20">
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_30px_80px_-20px_rgba(60,40,20,0.25)] dark:border-stone-800 dark:bg-stone-900">
              <div className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50 px-4 py-3 dark:border-stone-800 dark:bg-stone-800">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-stone-600" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-stone-600" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-stone-600" />
                <span className="ml-3 text-xs text-stone-400 dark:text-stone-500">
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
            <div className="absolute -bottom-10 -right-3 hidden w-36 overflow-hidden rounded-[2rem] border-[6px] border-stone-900 bg-stone-900 shadow-2xl dark:border-stone-700 md:block lg:w-44">
              <img
                src="/screenshots/demo.gif"
                alt="Placing an order on the shop side"
                className="w-full rounded-[1.5rem]"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        {/* ───────── Interactive features ───────── */}
        <FeatureShowcase />

        {/* ───────── Mobile screens ───────── */}
        <section className="border-t border-stone-200/70 dark:border-stone-800">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <div className="text-center">
              <h2 className="font-serif text-3xl font-medium tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
                Built for the shop floor
              </h2>
              <p className="mx-auto mt-3 max-w-md text-stone-600 dark:text-stone-400">
                Shops order, track, and check their balance — all from a phone.
              </p>
            </div>
            <div className="mt-14 flex flex-wrap items-start justify-center gap-6 sm:gap-10">
              {PHONES.map((s) => (
                <figure key={s.src} className="w-40 sm:w-48">
                  <div className="overflow-hidden rounded-[2rem] border-[6px] border-stone-900 bg-stone-900 shadow-xl transition hover:-translate-y-1.5 dark:border-stone-700">
                    <img
                      src={s.src}
                      alt={s.label}
                      className="w-full rounded-[1.5rem]"
                      loading="lazy"
                    />
                  </div>
                  <figcaption className="mt-3 text-center text-sm text-stone-500 dark:text-stone-500">
                    {s.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Tech stack ───────── */}
        <section className="border-t border-stone-200/70 bg-[#f4f2ec] dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-stone-900 dark:text-stone-50 sm:text-3xl">
              Built with a modern stack
            </h2>
            <p className="mt-3 text-stone-600 dark:text-stone-400">
              A type-safe, full-stack TypeScript monorepo — end to end.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-2.5">
              {STACK.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-stone-200 bg-[#faf9f5] px-4 py-2 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── CTA + footer ───────── */}
        <section className="border-t border-stone-200/70 dark:border-stone-800">
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <h2 className="font-serif text-3xl font-medium tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-stone-600 dark:text-stone-400">
              Log in with the account created for you by the administrator.
            </p>
            <Link
              to="/login"
              className="group mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-medium text-white shadow-sm transition hover:brightness-95"
              style={{ backgroundColor: CLAY }}
            >
              Log in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <footer className="border-t border-stone-200/70 px-6 py-8 text-center text-sm text-stone-400 dark:border-stone-800 dark:text-stone-500">
            Tamurfood — B2B bakery ordering &amp; Khata ledger.
          </footer>
        </section>
      </div>
    </div>
  );
}

// Horizontal, clickable feature switcher: pick a feature from the row of tabs
// and its details + screenshot appear below.
function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const f = FEATURES[active];
  const Icon = f.icon;

  return (
    <section className="border-t border-stone-200/70 bg-[#f4f2ec] dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="font-serif text-3xl font-medium tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            Everything a wholesale supplier needs
          </h2>
          <p className="mt-3 text-stone-600 dark:text-stone-400">
            Tap through the platform — one place for orders, fulfilment, and the
            money in between.
          </p>
        </div>

        {/* horizontal tab row */}
        <div className="mt-10 flex flex-wrap gap-2.5">
          {FEATURES.map((feat, i) => {
            const on = i === active;
            const TabIcon = feat.icon;
            return (
              <button
                key={feat.title}
                type="button"
                onClick={() => setActive(i)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  on
                    ? "border-transparent text-white shadow-sm"
                    : "border-stone-200 bg-[#faf9f5] text-stone-600 hover:border-stone-300 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
                style={on ? { backgroundColor: CLAY } : undefined}
              >
                <TabIcon className="h-4 w-4" />
                {feat.title}
              </button>
            );
          })}
        </div>

        {/* detail panel for the active feature */}
        <div className="mt-8 grid items-center gap-10 rounded-2xl border border-stone-200 bg-[#faf9f5] p-8 dark:border-stone-800 dark:bg-stone-950 md:grid-cols-2 md:p-10">
          <div>
            <div
              className="grid h-11 w-11 place-items-center rounded-xl"
              style={{ backgroundColor: `${CLAY}22`, color: CLAY }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-stone-900 dark:text-stone-50">
              {f.title}
            </h3>
            <p className="mt-1.5 text-stone-600 dark:text-stone-400">
              {f.summary}
            </p>
            <ul className="mt-5 space-y-3">
              {f.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm">
                  <Check
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: CLAY }}
                  />
                  <span className="text-stone-700 dark:text-stone-300">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* screenshot (phone or browser frame), or a fallback tile */}
          <div className="flex justify-center">
            {f.img ? (
              f.phone ? (
                <div className="w-40 overflow-hidden rounded-[2rem] border-[6px] border-stone-900 bg-stone-900 shadow-xl dark:border-stone-700 sm:w-48">
                  <img
                    src={f.img}
                    alt={f.title}
                    className="w-full rounded-[1.5rem]"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-800 dark:bg-stone-900">
                  <div className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-800">
                    <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
                    <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
                    <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
                  </div>
                  <img
                    src={f.img}
                    alt={f.title}
                    className="w-full"
                    loading="lazy"
                  />
                </div>
              )
            ) : (
              <div
                className="grid h-40 w-full place-items-center rounded-xl border"
                style={{
                  borderColor: `${CLAY}22`,
                  backgroundColor: `${CLAY}0a`,
                }}
              >
                <Icon className="h-12 w-12" style={{ color: CLAY }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
