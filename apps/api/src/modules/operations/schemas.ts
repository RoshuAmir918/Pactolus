import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import {
  runOperationActorTypeEnum,
  runStatusEnum,
  runOperations,
  runOperationCaptures,
} from "@db/schema";

export const runOperationTypeSchema = z.string().trim().min(1);
export const runOperationActorTypeSchema = z.enum(runOperationActorTypeEnum.enumValues);
export const runStatusSchema = z.enum(runStatusEnum.enumValues);

// Derived from DB table — stays in sync automatically
const runOperationOutputSchema = createSelectSchema(runOperations).pick({
  id: true,
  runId: true,
  operationIndex: true,
  operationType: true,
  parentOperationId: true,
  supersedesOperationId: true,
  documentId: true,
  parametersJson: true,
  actorType: true,
  actorId: true,
  createdAt: true,
});

const runOperationCaptureOutputSchema = createSelectSchema(runOperationCaptures).pick({
  id: true,
  captureType: true,
  payloadJson: true,
  summaryText: true,
  createdAt: true,
});

// ── run ───────────────────────────────────────────────────────────────────────

export const createRunInputSchema = z.object({
  snapshotId: z.uuid(),
  name: z.string().min(1).optional(),
});

export const createRunOutputSchema = z.object({
  runId: z.uuid(),
  status: runStatusSchema,
});

// ── operation ─────────────────────────────────────────────────────────────────

export const appendOperationInputSchema = z.object({
  runId: z.uuid(),
  operationType: runOperationTypeSchema,
  documentId: z.uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  parentOperationId: z.uuid().optional(),
  supersedesOperationId: z.uuid().optional(),
  parametersJson: z.unknown(),
});

export const appendOperationOutputSchema = z.object({
  operationId: z.uuid(),
  runId: z.uuid(),
  operationIndex: z.number().int().positive(),
  operationType: runOperationTypeSchema,
  actorType: runOperationActorTypeSchema,
  actorId: z.uuid().nullable(),
});

export const getRunOperationsInputSchema = z.object({
  runId: z.uuid(),
});

export const getRunOperationsOutputSchema = z.object({
  operations: z.array(runOperationOutputSchema),
});

export const getOperationAncestorsInputSchema = z.object({
  runId: z.uuid(),
  operationId: z.uuid(),
});

export const getOperationAncestorsOutputSchema = z.object({
  operations: z.array(runOperationOutputSchema),
});

// ── captures ──────────────────────────────────────────────────────────────────

export const saveOperationCaptureInputSchema = z.object({
  runId: z.uuid(),
  runOperationId: z.uuid(),
  captureType: z.string().min(1),
  payloadJson: z.unknown(),
  summaryText: z.string().nullable().optional(),
});

export const saveOperationCaptureOutputSchema = z.object({
  captureId: z.uuid(),
  runOperationId: z.uuid(),
  captureType: z.string(),
});

export const getOperationCapturesInputSchema = z.object({
  runId: z.uuid(),
  operationId: z.uuid(),
});

export const getOperationCapturesOutputSchema = z.object({
  captures: z.array(runOperationCaptureOutputSchema),
});

// ── analyst notes ─────────────────────────────────────────────────────────────

export const setOperationNoteInputSchema = z.object({
  runId: z.uuid(),
  operationId: z.uuid(),
  noteText: z.string(),
});

export const setOperationNoteOutputSchema = z.object({
  deleted: z.boolean(),
  noteText: z.string().nullable(),
});

export const getOperationNoteInputSchema = z.object({
  runId: z.uuid(),
  operationId: z.uuid(),
});

export const getOperationNoteOutputSchema = z.object({
  noteText: z.string().nullable(),
  updatedAt: z.date().nullable(),
});

// ── comparison analysis ───────────────────────────────────────────────────────

export const analyzeComparisonInputSchema = z.object({
  runId: z.uuid(),
  operationIds: z.array(z.uuid()).min(2).max(3),
});

export const analyzeComparisonOutputSchema = z.object({
  narrative: z.string(),
});

// ── label generation ──────────────────────────────────────────────────────────

export const generateOperationLabelInputSchema = z.object({
  runId: z.uuid(),
  operationId: z.uuid(),
});

export const generateOperationLabelOutputSchema = z.object({
  label: z.string(),
});

// ── run branches ─────────────────────────────────────────────────────────────

export const getRunBranchesInputSchema = z.object({
  runId: z.uuid(),
});

export const getRunBranchesOutputSchema = z.object({
  branches: z.array(runOperationOutputSchema),
});

// ── runs listing ──────────────────────────────────────────────────────────────

export const getRunsBySnapshotInputSchema = z.object({
  snapshotId: z.uuid(),
  limit: z.number().int().positive().max(100).optional(),
});

// createdByName is joined from users — can't derive from runs table directly
export const getRunsBySnapshotOutputSchema = z.object({
  runs: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      status: runStatusSchema,
      createdByName: z.string(),
      nodeCount: z.number().int().nonnegative(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  ),
});
