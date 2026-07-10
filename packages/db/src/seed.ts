import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { user, session, account, verification } from "./schema";

const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: { enabled: true },
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: phone, code }) => {
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

async function seed() {
  console.log("Seeding admin user...");

  // Create via email sign-up (email+password flow)
  const result = await auth.api.signUpEmail({
    body: {
      email: "admin@tamurfood.local",
      password: "admin123",
      name: "Admin",
    },
  });

  if (!result || !("user" in result)) {
    console.log("Admin user may already exist. Skipping.");
    process.exit(0);
  }

  const adminUser = result.user as { id: string };

  // Update role and phone_number directly in the DB
  await db
    .update(user)
    .set({
      role: "admin",
      phoneNumber: "01700000000",
    })
    .where(eq(user.id, adminUser.id));

  console.log(`Admin user created: ${adminUser.id}`);
  console.log("  Phone: 01700000000");
  console.log("  Password: admin123");
  console.log("  Email: admin@tamurfood.local");

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
