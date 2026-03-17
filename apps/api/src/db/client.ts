import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL missing");
}

const pool = new pg.Pool({ connectionString });
const db = drizzle(pool);

pool.query("SELECT current_database()").then(
  (res) => console.log("[db] current_database:", res.rows[0]?.current_database),
  (err) => console.error("[db] current_database check failed:", err),
);

export default { db, pool };