import * as Sentry from "@sentry/bun";
import { serveStatic } from "hono/bun";
import app from "./app";
import { env } from "./env";
import { startStaleOrderSweeper } from "./lib/stale-orders";

// Error tracking — only active when SENTRY_DSN is set (production). No-op locally.
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

// In production, serve the built frontend with runtime config injected.
if (env.NODE_ENV === "production") {
  // Inject runtime config into the HTML so the frontend can read keys that
  // aren't baked in at build time (Railway doesn't reliably pass VITE_ build
  // args). Only public-safe values go here.
  const runtimeConfig = { SENTRY_DSN: env.SENTRY_DSN ?? null };
  const indexHtml = (await Bun.file("apps/web/dist/index.html").text()).replace(
    "</head>",
    `<script>window.__ENV__=${JSON.stringify(runtimeConfig)}</script></head>`,
  );
  const serveIndex = () =>
    new Response(indexHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  // Serve the injected HTML for the homepage. This MUST come before serveStatic,
  // which would otherwise return the un-injected dist/index.html for "/".
  app.get("/", serveIndex);
  // Static assets (hashed JS/CSS/images) are served from disk.
  app.use("/*", serveStatic({ root: "apps/web/dist" }));
  // SPA fallback for client-side routes (/login, /admin, …) → injected HTML.
  app.get("/*", serveIndex);
}

// End-of-day cleanup: auto-cancel orders left pending from previous days so they
// don't linger on the dashboard or a shop's live tracker.
startStaleOrderSweeper();

export default {
  port: env.PORT,
  fetch: app.fetch,
  idleTimeout: 0, // disable timeout — required for SSE long-lived connections
};
