import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { zValidator } from "../lib/validator";
import { db } from "@tamurfood/db";
import { banner } from "@tamurfood/db/schema";
import { requireAdmin, requireSession, type Variables } from "../lib/helpers";

const BANNER_ID = "default";

const updateBannerSchema = z.object({
  title: z.string().max(100).optional().nullable(),
  subtitle: z.string().max(60).optional().nullable(),
  tagline: z.string().max(150).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  enabled: z.boolean(),
});

export const bannerRouter = new Hono<{ Variables: Variables }>()
  // GET / — current banner (any authenticated user; the shop reads it)
  .get("/", async (c) => {
    const authErr = requireSession(c);
    if (authErr) return authErr;
    const rows = await db
      .select()
      .from(banner)
      .where(eq(banner.id, BANNER_ID))
      .limit(1);
    return c.json(rows[0] ?? null);
  })
  // PUT / — update banner (admin only)
  .put("/", zValidator("json", updateBannerSchema), async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const body = c.req.valid("json");
    await db
      .insert(banner)
      .values({ id: BANNER_ID, ...body, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: banner.id,
        set: { ...body, updatedAt: new Date() },
      });

    return c.json({ success: true });
  });
