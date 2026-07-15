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
  // Admin-controlled draft/publish. When false, the item is hidden from shops
  // and moderators entirely (only the admin sees it). Distinct from isAvailable
  // (stock-out), which still shows the item but marks it unavailable.
  isVisible: boolean("is_visible").notNull().default(true),
  // NULL = untracked / unlimited stock. When set, online orders decrement it
  // atomically and the item auto-goes "Stock Out" at 0.
  stockQuantity: integer("stock_quantity"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: serial("order_number"),
    // Bakery-wide number that resets each day (Bangladesh time) — the friendly
    // "Order #5 today". orderNumber stays as the permanent unique reference.
    dailyNumber: integer("daily_number"),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    totalAmount: integer("total_amount").notNull(),
    note: varchar("note", { length: 500 }),
    isDone: boolean("is_done").notNull().default(false),
    isPaid: boolean("is_paid").notNull().default(false),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    cancelReason: varchar("cancel_reason", { length: 300 }),
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
    // The specific order this payment settled, when it came from "Mark Paid" on
    // one order. NULL for lump-sum "Record Payment" entries (partial/multi-order).
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [index("payments_shop_date_idx").on(t.shopId, t.paymentDate)],
);

// Atomic per-day counter that generates the resetting daily order number.
// One row per day (in Bangladesh time); last_number is bumped on each order.
export const orderDailyCounters = pgTable("order_daily_counters", {
  orderDate: date("order_date").primaryKey(),
  lastNumber: integer("last_number").notNull(),
});

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

export const pendingMenuChanges = pgTable("pending_menu_changes", {
  id: text("id").primaryKey(),
  type: varchar("type", { length: 10 }).notNull(), // "create" | "update" | "delete"
  proposedBy: text("proposed_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  menuItemId: text("menu_item_id"), // null for create
  proposedData: jsonb("proposed_data"), // item fields for create/update, null for delete
  status: varchar("status", { length: 10 }).notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

// Singleton row (id = "default") holding the shop hero banner, editable by admin.
export const banner = pgTable("banner", {
  id: text("id").primaryKey(),
  title: varchar("title", { length: 100 }),
  subtitle: varchar("subtitle", { length: 60 }),
  tagline: varchar("tagline", { length: 150 }),
  imageUrl: text("image_url"),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull(),
});
