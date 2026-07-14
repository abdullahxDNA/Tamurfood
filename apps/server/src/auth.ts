import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins";
import { db } from "@tamurfood/db";
import { user, session, account, verification } from "@tamurfood/db/schema";
import { Resend } from "resend";
import { env } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Invite-only B2B: block public self-registration via /api/auth/sign-up/email.
    // Shop accounts are created by the admin (see routes/shops.ts), which uses the
    // internal adapter directly and is unaffected by this flag.
    disableSignUp: true,
    sendResetPassword: async ({ user: u, url }) => {
      console.log(`[reset-password] sending to ${u.email}`);
      try {
        if (!env.RESEND_API_KEY) {
          console.warn(
            "[reset-password] RESEND_API_KEY not set, skipping email",
          );
          return;
        }
        const resend = new Resend(env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: "Tamurfood <onboarding@resend.dev>",
          to: u.email,
          subject: "Reset your Tamurfood password",
          html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 15 minutes.</p>`,
        });
        if (error) throw error;
        console.log(`[reset-password] sent OK to ${u.email}`);
      } catch (err) {
        console.error("[reset-password] failed to send email:", err);
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  // In-memory rate limiting — fine for a single Railway instance. A
  // multi-instance deployment would need shared (database) storage.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/*": { window: 60, max: 5 },
    },
  },
  trustedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL],
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: phone, code }) => {
        // AUTH-04 deferred — log for now
        console.log(`[OTP] ${phone}: ${code}`);
      },
      requireVerification: false,
    }),
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "shop",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
});
