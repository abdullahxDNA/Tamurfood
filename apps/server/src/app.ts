import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import * as Sentry from "@sentry/bun";
import { db } from "@tamurfood/db";
import { sql } from "drizzle-orm";
import { auth } from "./auth";
import { APIError } from "better-auth/api";
import { env } from "./env";
import { shopsRouter } from "./routes/shops";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { adminRouter } from "./routes/admin";
import { khataRouter } from "./routes/khata";
import { bannerRouter } from "./routes/banner";
import type { Variables } from "./lib/helpers";

const app = new Hono<{ Variables: Variables }>()
  .use(logger())
  .use(
    "/api/*",
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      allowHeaders: ["Content-Type"],
    }),
  )
  .use(secureHeaders())
  .on(["GET", "POST"], "/api/auth/*", async (c) => {
    try {
      return await auth.handler(c.req.raw);
    } catch (err) {
      console.error("[auth handler error]", err);
      return c.json({ error: "Authentication error" }, 500);
    }
  })
  // Session middleware for /api/v1/* routes. A deactivated user (isActive=false)
  // is treated as having NO session, so every guarded route rejects them — even
  // if they still hold a valid cookie or sign in again. This is what makes
  // "disable account" actually keep them out, not just log them out once.
  .use("/api/v1/*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("session", session && session.user.isActive ? session : null);
    await next();
  })
  // Health check pings the DB so Railway only considers the app healthy when
  // Postgres is actually reachable — a running server with a dead DB is not
  // "up". Returns 503 on failure so the platform can restart / hold traffic.
  .get("/api/health", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: "ok" });
    } catch (err) {
      console.error("[health] database check failed:", err);
      return c.json({ status: "error", database: "unreachable" }, 503);
    }
  })
  // GET /api/v1/auth/me — return current session user
  .get("/api/v1/auth/me", (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const { user } = session;
    return c.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isActive: user.isActive,
    });
  })
  // PUT /api/v1/auth/change-password
  .put("/api/v1/auth/change-password", async (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json<{
      currentPassword: string;
      newPassword: string;
    }>();

    try {
      await auth.api.changePassword({
        body: {
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
        },
        headers: c.req.raw.headers,
      });
      return c.json({ success: true });
    } catch (error) {
      // Better Auth APIError messages (e.g. wrong current password) are safe to
      // surface. Anything else is unexpected — log it, return a generic message.
      if (error instanceof APIError) {
        return c.json({ error: error.message }, 400);
      }
      console.error("[change-password error]", error);
      return c.json({ error: "Failed to change password" }, 400);
    }
  })
  .route("/api/v1/shops", shopsRouter)
  .route("/api/v1/menu", menuRouter)
  .route("/api/v1/orders", ordersRouter)
  .route("/api/v1/admin", adminRouter)
  .route("/api/v1/khata", khataRouter)
  .route("/api/v1/banner", bannerRouter);

// Global fallback: report the error (Sentry, if configured), log it, and never
// leak internals to the client.
app.onError((err, c) => {
  Sentry.captureException(err);
  console.error("[unhandled error]", err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
export type AppType = typeof app;
