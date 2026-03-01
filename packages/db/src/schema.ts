import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";

export const testConnection = pgTable("test_connection", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
