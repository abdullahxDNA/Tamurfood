import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Server-side environment validation. Imported at startup (via auth.ts) so the
 * process fails fast with a clear error on missing/misconfigured env instead of
 * silently falling back to insecure localhost defaults.
 *
 * SERVER-ONLY: never import this from web/ code — these vars don't exist during
 * `vite build`. Frontend uses VITE_* vars read directly by Vite.
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    CORS_ORIGIN: z.string().url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(3000),

    // Resend (password-reset emails)
    RESEND_API_KEY: z.string().min(1),

    // Supabase Storage (server-side image uploads via service role)
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
