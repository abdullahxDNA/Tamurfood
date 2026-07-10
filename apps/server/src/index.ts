import { serveStatic } from "hono/bun";
import app from "./app";

// In production, serve the built frontend and fall back to index.html for SPA routing
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "apps/web/dist" }));
  app.get("/*", (c) => new Response(Bun.file("apps/web/dist/index.html")));
}

export default {
  port: parseInt(process.env.PORT ?? "3000"),
  fetch: app.fetch,
  idleTimeout: 0, // disable timeout — required for SSE long-lived connections
};
