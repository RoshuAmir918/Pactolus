import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),
  TEMPORAL_TASK_QUEUE: z.string().default("pactolus-ingestion"),
  TEMPORAL_INGESTION_TASK_QUEUE: z.string().optional(),
  TEMPORAL_RECONCILIATION_TASK_QUEUE: z.string().optional(),
});

export const env = envSchema.parse(process.env);
