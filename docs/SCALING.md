# Scaling & Operations Notes

You don't build scaling before you need it — but you should know the plan. This
is the path for Tamurfood as traffic grows, and the one thing to fix **before**
running more than one server instance.

## Current shape (fine for a long way)

- One Bun/Hono server on Railway serves **both** the API and the built frontend.
- PostgreSQL on Supabase (via the connection pooler).
- Good for **hundreds of shops** and dozens of concurrent users. B2B traffic is
  light — you're nowhere near the limits.

## The usual bottleneck: the database (not the web server)

When load climbs, the DB falls over first — not Bun. In order:

1. **Upgrade the Supabase plan** — more compute + connections. Biggest single win.
2. **Keep using the pooler** (already in place) — avoids connection exhaustion.
3. **Add caching / a CDN (Cloudflare)** in front to absorb spikes and cache reads.
4. **Read replicas** for heavy read traffic (later).

> nginx is **not** part of this — Railway's edge already does TLS/routing/LB, and
> the Bun server serves static files. nginx only enters the picture if you leave
> Railway for a bare VPS.

## ⚠️ Must fix BEFORE running multiple instances

Two pieces currently assume a **single** server process. Running >1 replica will
break them until reworked:

1. **Live order tracker (SSE)** — `apps/server/src/lib/order-events.ts` uses an
   in-process `EventEmitter`. Events emitted on instance A won't reach clients
   connected to instance B. **Fix:** move to a shared bus — **Supabase Realtime**
   (already available) or Redis pub/sub.

2. **Stale-order sweeper** — `apps/server/src/lib/stale-orders.ts` runs on a
   `setInterval` in every process, so N instances = N sweeps. It's idempotent so
   it won't corrupt data, but it's wasteful. **Fix:** make it a single scheduled
   job — e.g. a GitHub Action / cron hitting a protected endpoint, or leader
   election — instead of per-instance timers.

Until those are done, **scale up** (bigger single instance) rather than **out**
(more instances).

## Signs it's time to act

- Supabase dashboard shows high DB CPU or hitting the connection limit
- Slow queries / rising response times under normal load
- Railway instance CPU/memory consistently high

## Rough growth playbook

| Stage                         | Move                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| Now → ~100s of shops          | Do nothing — current setup handles it                      |
| Slowness / connection errors  | Upgrade Supabase plan (+ keep pooler)                      |
| Traffic spikes / global users | Add Cloudflare (CDN + cache + TLS)                         |
| One instance maxed            | Rework SSE + sweeper for multi-instance, then add replicas |
| Very read-heavy               | Add DB read replicas                                       |
