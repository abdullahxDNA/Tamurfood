import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "@tamurfood/db";
import { user, session, account, shops } from "@tamurfood/db/schema";
import { auth } from "../auth";
import { requireAdmin, requireSession, getShopForUser, type Variables } from "../lib/helpers";

const createShopSchema = z.object({
  shopName: z.string().min(1).max(150),
  ownerName: z.string().min(1).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  password: z.string().min(6),
});

const updateShopSchema = z.object({
  shopName: z.string().min(1).max(150),
  ownerName: z.string().min(1).max(100),
  address: z.string().max(500).optional().nullable(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

export const shopsRouter = new Hono<{ Variables: Variables }>()
  // GET /me — return the current shop user's own shop info
  .get("/me", async (c) => {
    const authErr = requireSession(c);
    if (authErr) return authErr;
    const session = c.get("session")!;
    const rows = await db
      .select({
        shopId: shops.id,
        shopName: shops.shopName,
        ownerName: shops.ownerName,
        address: shops.address,
        phone: user.phoneNumber,
      })
      .from(shops)
      .innerJoin(user, eq(shops.userId, user.id))
      .where(eq(shops.userId, session.user.id))
      .limit(1);
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json(rows[0]);
  })
  // GET / — list all shops with user info
  .get("/", async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const rows = await db
      .select({
        id: shops.id,
        shopName: shops.shopName,
        ownerName: shops.ownerName,
        address: shops.address,
        createdAt: shops.createdAt,
        userId: shops.userId,
        phone: user.phoneNumber,
        email: user.email,
        isActive: user.isActive,
      })
      .from(shops)
      .innerJoin(user, eq(shops.userId, user.id))
      .orderBy(shops.createdAt);

    return c.json(rows);
  })
  // POST / — create user + shop
  .post("/", zValidator("json", createShopSchema), async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const body = c.req.valid("json");

    // Unique phone check
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.phoneNumber, body.phone))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Phone number already in use" }, 409);
    }

    const email = body.email ?? `${body.phone}@tamurfood.local`;

    // Create auth user via Better Auth
    const result = await auth.api.signUpEmail({
      body: {
        email,
        name: body.ownerName,
        password: body.password,
      },
    });

    if (!result || !result.user) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    const userId = result.user.id;

    // Update user with phone, role
    await db
      .update(user)
      .set({
        phoneNumber: body.phone,
        role: "shop",
        name: body.ownerName,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // Create shop record
    const shopId = crypto.randomUUID();
    await db.insert(shops).values({
      id: shopId,
      userId,
      shopName: body.shopName,
      ownerName: body.ownerName,
      address: body.address ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return c.json({ id: shopId }, 201);
  })
  // PUT /:id — update shop + user name
  .put("/:id", zValidator("json", updateShopSchema), async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const id = c.req.param("id");
    const body = c.req.valid("json");

    const shop = await db
      .select({ userId: shops.userId })
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (shop.length === 0) {
      return c.json({ error: "Shop not found" }, 404);
    }

    await Promise.all([
      db
        .update(shops)
        .set({
          shopName: body.shopName,
          ownerName: body.ownerName,
          address: body.address ?? null,
          updatedAt: new Date(),
        })
        .where(eq(shops.id, id)),
      db
        .update(user)
        .set({ name: body.ownerName, updatedAt: new Date() })
        .where(eq(user.id, shop[0].userId)),
    ]);

    return c.json({ success: true });
  })
  // PATCH /:id/status — toggle isActive; delete sessions on disable
  .patch("/:id/status", async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const id = c.req.param("id");

    const shop = await db
      .select({ userId: shops.userId })
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (shop.length === 0) {
      return c.json({ error: "Shop not found" }, 404);
    }

    const userId = shop[0].userId;

    const currentUser = await db
      .select({ isActive: user.isActive })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const newStatus = !currentUser[0].isActive;

    await db
      .update(user)
      .set({ isActive: newStatus, updatedAt: new Date() })
      .where(eq(user.id, userId));

    if (!newStatus) {
      // Delete sessions when disabling
      await db.delete(session).where(eq(session.userId, userId));
    }

    return c.json({ isActive: newStatus });
  })
  // POST /:id/reset-password — admin resets shop user password
  .post(
    "/:id/reset-password",
    zValidator("json", resetPasswordSchema),
    async (c) => {
      const err = requireAdmin(c);
      if (err) return err;

      const id = c.req.param("id");
      const { newPassword } = c.req.valid("json");

      const shop = await db
        .select({ userId: shops.userId })
        .from(shops)
        .where(eq(shops.id, id))
        .limit(1);

      if (shop.length === 0) {
        return c.json({ error: "Shop not found" }, 404);
      }

      const userId = shop[0].userId;

      const ctx = await auth.$context;
      const hash = await ctx.password.hash(newPassword);

      await db
        .update(account)
        .set({ password: hash, updatedAt: new Date() })
        .where(eq(account.userId, userId));

      await db.delete(session).where(eq(session.userId, userId));

      return c.json({ success: true });
    },
  );
