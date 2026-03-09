import { z } from "zod";
import { mappingProposalSchema } from "@db/mappingSchema";

export const entityTypeSchema = z.enum(["claim", "policy"]);

export const createSnapshotInputSchema = z.object({
  label: z.string().min(1),
  accountingPeriod: z.string().min(1).optional(),
});

export const createSnapshotOutputSchema = z.object({
  snapshotId: z.uuid(),
  status: z.enum(["draft", "ingesting", "ready", "failed"]),
});

export const uploadCsvInputSchema = z.object({
  snapshotId: z.uuid(),
  fileName: z.string().min(1),
  csvText: z.string().min(1),
});

export const uploadCsvOutputSchema = z.object({
  runId: z.uuid(),
  uploadStepId: z.uuid(),
  snapshotInputId: z.uuid(),
  entityType: entityTypeSchema,
  detectedColumns: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  sampleRows: z.array(z.record(z.string(), z.string())).max(5),
});

export const batchUploadFileSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1),
  entityType: entityTypeSchema.optional(),
});

export const uploadBatchCsvInputSchema = z.object({
  snapshotId: z.uuid(),
  files: z.array(batchUploadFileSchema).min(1),
});

export const uploadBatchCsvOutputSchema = z.object({
  uploads: z.array(uploadCsvOutputSchema),
});

export const confirmMappingInputSchema = z.object({
  runId: z.uuid(),
  snapshotInputId: z.uuid(),
  suggestedMappingStepId: z.uuid(),
  acceptedMappingJson: mappingProposalSchema.optional(),
});

export const confirmMappingOutputSchema = z.object({
  acceptedMappingStepId: z.uuid(),
  workflowId: z.string(),
  workflowRunId: z.string(),
});
