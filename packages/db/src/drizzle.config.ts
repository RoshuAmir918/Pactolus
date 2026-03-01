import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const env = envSchema.parse(process.env);

export default defineConfig({
  out: "./src/migrations",
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
