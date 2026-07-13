import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const isLocal =
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("localhost");
const client = postgres(connectionString, { ssl: isLocal ? false : "require" });

export const db = drizzle(client, { schema });
export type Database = typeof db;
