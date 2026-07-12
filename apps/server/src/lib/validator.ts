import { zValidator as zv } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodSchema } from "zod";

/**
 * Wrapper around @hono/zod-validator that returns validation failures in the
 * same shape as the rest of the API ({ error: "message" }) instead of the raw
 * ZodError object. Keeps client error handling uniform (no "[object Object]").
 * Generics are preserved so Hono RPC input type inference still works.
 */
export function zValidator<
  T extends ZodSchema,
  Target extends keyof ValidationTargets,
>(target: Target, schema: T) {
  return zv(target, schema, (result, c) => {
    if (!result.success) {
      const first = result.error.issues[0];
      const field = first?.path.join(".");
      const message = first
        ? field
          ? `${field}: ${first.message}`
          : first.message
        : "Invalid input";
      return c.json({ error: message }, 400);
    }
  });
}
