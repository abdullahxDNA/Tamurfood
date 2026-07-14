import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { shops } from "@tamurfood/db/schema";
import type { auth } from "../auth";

export type Variables = { session: typeof auth.$Infer.Session | null };

export async function getShopForUser(userId: string) {
  const result = await db
    .select({ id: shops.id, shopName: shops.shopName })
    .from(shops)
    .where(eq(shops.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

export function requireSession(c: Context<{ Variables: Variables }>) {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}

export function requireAdmin(c: Context<{ Variables: Variables }>) {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (session.user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  return null;
}

export function requireModerator(c: Context<{ Variables: Variables }>) {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (session.user.role !== "admin" && session.user.role !== "moderator") {
    return c.json({ error: "Forbidden" }, 403);
  }
  return null;
}
