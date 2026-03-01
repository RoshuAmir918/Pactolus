import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
});

export const env = envSchema.parse(process.env);
