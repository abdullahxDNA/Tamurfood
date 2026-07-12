import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phoneNumber: varchar("phone_number", { length: 20 }).unique(),
  phoneNumberVerified: boolean("phone_number_verified")
    .notNull()
    .default(false),
  role: varchar("role", { length: 10 }).notNull().default("shop"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const shops = pgTable("shops", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  shopName: varchar("shop_name", { length: 150 }).notNull(),
  ownerName: varchar("owner_name", { length: 100 }).notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  price: integer("price").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: serial("order_number"),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    totalAmount: integer("total_amount").notNull(),
    note: varchar("note", { length: 500 }),
    isDone: boolean("is_done").notNull().default(false),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    placedAt: timestamp("placed_at").notNull(),
    doneAt: timestamp("done_at"),
    cancelledAt: timestamp("cancelled_at"),
  },
  (t) => [
    index("orders_shop_placed_idx").on(t.shopId, t.placedAt),
    index("orders_done_placed_idx").on(t.isDone, t.placedAt),
  ],
);

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: text("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "restrict" }),
  itemName: varchar("item_name", { length: 100 }).notNull(),
  itemPrice: integer("item_price").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: integer("line_total").notNull(),
  itemNote: varchar("item_note", { length: 200 }),
});

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    paymentDate: date("payment_date").notNull(),
    note: varchar("note", { length: 300 }),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [index("payments_shop_date_idx").on(t.shopId, t.paymentDate)],
);

export const menuCategories = pgTable("menu_categories", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull(),
});

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [index("analytics_event_type_idx").on(t.eventType, t.createdAt)],
);
