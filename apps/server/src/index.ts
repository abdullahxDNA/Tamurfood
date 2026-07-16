import { serveStatic } from "hono/bun";
import app from "./app";
import { env } from "./env";
import { startStaleOrderSweeper } from "./lib/stale-orders";

// In production, serve the built frontend and fall back to index.html for SPA routing
if (env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "apps/web/dist" }));
  app.get("/*", () => new Response(Bun.file("apps/web/dist/index.html")));
}

// End-of-day cleanup: auto-cancel orders left pending from previous days so they
// don't linger on the dashboard or a shop's live tracker.
startStaleOrderSweeper();

export default {
  port: env.PORT,
  fetch: app.fetch,
  idleTimeout: 0, // disable timeout — required for SSE long-lived connections
};
