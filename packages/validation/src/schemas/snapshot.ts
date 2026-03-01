import { z } from "zod";
import { transactionSchema } from "./transaction.js";

export const snapshotCreateSchema = z.object({
  dealId: z.string().uuid(),
  source: z.enum(["csv", "api", "manual"]).default("csv"),
});

export const snapshotIngestRowsSchema = z.object({
  snapshotId: z.string().uuid(),
  rows: z.array(transactionSchema).min(1),
});
