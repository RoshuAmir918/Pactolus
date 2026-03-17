import { z } from "zod";

export const createSnapshotInputSchema = z.object({
  clientId: z.uuid().optional(),
  label: z.string().min(1),
  accountingPeriod: z.string().min(1).optional(),
});

export const createSnapshotOutputSchema = z.object({
  snapshotId: z.uuid(),
  status: z.enum(["draft", "ingesting", "ready", "failed"]),
});
