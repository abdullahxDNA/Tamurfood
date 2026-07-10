import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./auth";
import { shopsRouter } from "./routes/shops";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { adminRouter } from "./routes/admin";
import { khataRouter } from "./routes/khata";
import type { Variables } from "./lib/helpers";

const app = new Hono<{ Variables: Variables }>()
  .use(
    "/api/*",
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
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
      return c.json({ error: String(err) }, 500);
    }
  })
  // Session middleware for /api/v1/* routes
  .use("/api/v1/*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("session", session);
    await next();
  })
  .get("/api/health", (c) => c.json({ status: "ok" }))
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
      const message =
        error instanceof Error ? error.message : "Failed to change password";
      return c.json({ error: message }, 400);
    }
  })
  .route("/api/v1/shops", shopsRouter)
  .route("/api/v1/menu", menuRouter)
  .route("/api/v1/orders", ordersRouter)
  .route("/api/v1/admin", adminRouter)
  .route("/api/v1/khata", khataRouter);

export default app;
export type AppType = typeof app;
