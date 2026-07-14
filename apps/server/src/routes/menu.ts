import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import { eq, asc } from "drizzle-orm";
import { db } from "@tamurfood/db";
import {
  menuItems,
  menuCategories,
  pendingMenuChanges,
} from "@tamurfood/db/schema";
import {
  requireAdmin,
  requireModerator,
  requireSession,
  type Variables,
} from "../lib/helpers";
import { env } from "../env";

const menuItemSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().int().positive(),
  category: z.string().min(1).max(50),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price: z.number().int().positive().optional(),
  category: z.string().min(1).max(50).optional(),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const menuRouter = new Hono<{ Variables: Variables }>()
  // GET / — list all items ordered by category then sortOrder
  .get("/", async (c) => {
    const err = requireSession(c);
    if (err) return err;

    const items = await db
      .select()
      .from(menuItems)
      .orderBy(
        asc(menuItems.category),
        asc(menuItems.sortOrder),
        asc(menuItems.name),
      );

    return c.json(items);
  })
  // POST / — add regular item
  .post("/", zValidator("json", menuItemSchema), async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const body = c.req.valid("json");
    const id = crypto.randomUUID();

    await db.insert(menuItems).values({
      id,
      name: body.name,
      price: body.price,
      category: body.category,
      imageUrl: body.imageUrl ?? null,
      sortOrder: body.sortOrder ?? 0,
      isAvailable: true,
      createdAt: new Date(),
    });

    return c.json({ id }, 201);
  })
  // GET /categories — list all categories ordered by sortOrder then name
  .get("/categories", async (c) => {
    const err = requireSession(c);
    if (err) return err;

    const cats = await db
      .select()
      .from(menuCategories)
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));

    return c.json(cats);
  })
  // PATCH /categories/reorder — set category order from the given id order (admin)
  .patch(
    "/categories/reorder",
    zValidator("json", z.object({ ids: z.array(z.string()) })),
    async (c) => {
      const err = requireAdmin(c);
      if (err) return err;
      const { ids } = c.req.valid("json");
      await Promise.all(
        ids.map((id, i) =>
          db
            .update(menuCategories)
            .set({ sortOrder: i })
            .where(eq(menuCategories.id, id)),
        ),
      );
      return c.json({ success: true });
    },
  )
  // PATCH /reorder — set item order within a category from the given id order (admin)
  .patch(
    "/reorder",
    zValidator("json", z.object({ ids: z.array(z.string()) })),
    async (c) => {
      const err = requireAdmin(c);
      if (err) return err;
      const { ids } = c.req.valid("json");
      await Promise.all(
        ids.map((id, i) =>
          db
            .update(menuItems)
            .set({ sortOrder: i })
            .where(eq(menuItems.id, id)),
        ),
      );
      return c.json({ success: true });
    },
  )
  // POST /categories — create category (admin only), 409 if name already exists
  .post(
    "/categories",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(50),
        sortOrder: z.number().int().optional(),
      }),
    ),
    async (c) => {
      const err = requireAdmin(c);
      if (err) return err;

      const body = c.req.valid("json");
      const id = crypto.randomUUID();

      try {
        await db.insert(menuCategories).values({
          id,
          name: body.name,
          sortOrder: body.sortOrder ?? 0,
          createdAt: new Date(),
        });
      } catch {
        return c.json({ error: "Category already exists" }, 409);
      }

      return c.json({ id }, 201);
    },
  )
  // DELETE /categories/:id — delete category (admin only)
  .delete("/categories/:id", async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const id = c.req.param("id");
    await db.delete(menuCategories).where(eq(menuCategories.id, id));

    return c.json({ success: true });
  })
  // PUT /categories/:id — rename category (admin only)
  .put(
    "/categories/:id",
    zValidator("json", z.object({ name: z.string().min(1).max(50) })),
    async (c) => {
      const err = requireAdmin(c);
      if (err) return err;

      const id = c.req.param("id");
      const { name } = c.req.valid("json");

      try {
        await db
          .update(menuCategories)
          .set({ name })
          .where(eq(menuCategories.id, id));
      } catch {
        return c.json({ error: "Category name already exists" }, 409);
      }

      return c.json({ success: true });
    },
  )
  // POST /upload — upload menu image (admin only), returns { url }
  .post("/upload", async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!(file instanceof File))
      return c.json({ error: "No file provided" }, 400);

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type))
      return c.json({ error: "Invalid file type" }, 400);
    if (file.size > 5 * 1024 * 1024)
      return c.json({ error: "File too large (max 5MiB)" }, 400);

    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${crypto.randomUUID()}.${ext}`;
    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/menu-images/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": file.type,
        },
        body: await file.arrayBuffer(),
      },
    );

    if (!res.ok) {
      console.error("[upload error]", await res.text());
      return c.json({ error: "Upload failed" }, 500);
    }

    return c.json(
      { url: `${supabaseUrl}/storage/v1/object/public/menu-images/${path}` },
      201,
    );
  })
  // PUT /:id — update regular item
  .put("/:id", zValidator("json", updateMenuItemSchema), async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const id = c.req.param("id");
    const body = c.req.valid("json");

    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Item not found" }, 404);
    }

    await db.update(menuItems).set(body).where(eq(menuItems.id, id));

    return c.json({ success: true });
  })
  // DELETE /:id — delete item
  .delete("/:id", async (c) => {
    const err = requireAdmin(c);
    if (err) return err;

    const id = c.req.param("id");

    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Item not found" }, 404);
    }

    await db.delete(menuItems).where(eq(menuItems.id, id));

    return c.json({ success: true });
  })
  // POST /pending — moderator submits a menu change for admin approval
  .post(
    "/pending",
    zValidator(
      "json",
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("create"),
          data: menuItemSchema,
        }),
        z.object({
          type: z.literal("update"),
          menuItemId: z.string().min(1),
          data: updateMenuItemSchema,
        }),
        z.object({
          type: z.literal("delete"),
          menuItemId: z.string().min(1),
        }),
      ]),
    ),
    async (c) => {
      const err = requireModerator(c);
      if (err) return err;

      const session = c.get("session")!;
      const body = c.req.valid("json");
      const id = crypto.randomUUID();

      await db.insert(pendingMenuChanges).values({
        id,
        type: body.type,
        proposedBy: session.user.id,
        menuItemId: body.type !== "create" ? body.menuItemId : null,
        proposedData: body.type !== "delete" ? body.data : null,
        status: "pending",
        createdAt: new Date(),
      });

      return c.json({ id }, 201);
    },
  )
  // PATCH /:id/stock — set/edit/clear stock count (admin or moderator, instant)
  // body: { quantity: number | null } — null clears tracking (unlimited again)
  .patch(
    "/:id/stock",
    zValidator(
      "json",
      z.object({ quantity: z.number().int().min(0).nullable() }),
    ),
    async (c) => {
      const err = requireModerator(c);
      if (err) return err;

      const id = c.req.param("id");
      const { quantity } = c.req.valid("json");

      const existing = await db
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(eq(menuItems.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json({ error: "Item not found" }, 404);
      }

      await db
        .update(menuItems)
        .set({ stockQuantity: quantity })
        .where(eq(menuItems.id, id));

      return c.json({ stockQuantity: quantity });
    },
  )
  // PATCH /:id/availability — toggle isAvailable (moderator can do this instantly)
  .patch("/:id/availability", async (c) => {
    const err = requireModerator(c);
    if (err) return err;

    const id = c.req.param("id");

    const existing = await db
      .select({ isAvailable: menuItems.isAvailable })
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Item not found" }, 404);
    }

    const newAvailability = !existing[0].isAvailable;

    await db
      .update(menuItems)
      .set({ isAvailable: newAvailability })
      .where(eq(menuItems.id, id));

    return c.json({ isAvailable: newAvailability });
  });
