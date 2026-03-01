import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

export default {
  port: 3000,
  fetch: app.fetch,
};
