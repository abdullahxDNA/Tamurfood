import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";

await migrate(db, { migrationsFolder: import.meta.dir + "/../drizzle" });
console.log("[db] migrations applied");
process.exit(0);
