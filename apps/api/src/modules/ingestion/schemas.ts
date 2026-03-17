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

export const startDocumentIngestionInputSchema = z.object({
  snapshotId: z.uuid(),
  documentId: z.uuid(),
});

export const startDocumentIngestionOutputSchema = z.object({
  documentId: z.uuid(),
  profileStatus: z.enum(["pending", "completed", "failed"]),
  aiStatus: z.enum(["pending", "completed", "failed"]),
  documentType: z.enum(["claims", "policies", "loss_triangles", "workbook_tool", "other"]),
  aiClassification: z.enum([
    "claims",
    "policies",
    "loss_triangles",
    "workbook_tool",
    "other",
    "unknown",
  ]),
  sheetCount: z.number().int().nonnegative(),
  triangleCount: z.number().int().nonnegative(),
  insightCount: z.number().int().nonnegative(),
  errorText: z.string().nullable(),
});

export const getDocumentIngestionStatusInputSchema = z.object({
  snapshotId: z.uuid(),
  documentId: z.uuid(),
});

export const getDocumentIngestionStatusOutputSchema = startDocumentIngestionOutputSchema;
