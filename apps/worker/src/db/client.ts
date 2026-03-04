import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});

const db = drizzle(pool);

export { db, pool };
