import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins";
import { db } from "@tamurfood/db";
import { user, session, account, verification } from "@tamurfood/db/schema";
import nodemailer from "nodemailer";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user: u, url }) => {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: u.email,
        subject: "Reset your Tamurfood password",
        html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 15 minutes.</p>`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  trustedOrigins: [
    process.env.CORS_ORIGIN ?? "http://localhost:5173",
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ],
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
