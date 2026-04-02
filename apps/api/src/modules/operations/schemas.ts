import { z } from "zod";
import { runOperationActorTypeEnum, runStatusEnum } from "@db/schema";

export const runOperationTypeSchema = z.string().trim().min(1);
export const runOperationActorTypeSchema = z.enum(runOperationActorTypeEnum.enumValues);
export const runStatusSchema = z.enum(runStatusEnum.enumValues);

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
  operations: z.array(
    z.object({
      id: z.uuid(),
      runId: z.uuid(),
      operationIndex: z.number().int().positive(),
      operationType: runOperationTypeSchema,
      parentOperationId: z.uuid().nullable(),
      supersedesOperationId: z.uuid().nullable(),
      documentId: z.uuid().nullable(),
      parametersJson: z.unknown(),
      actorType: runOperationActorTypeSchema,
      actorId: z.uuid().nullable(),
      createdAt: z.date(),
    }),
  ),
});

export const getOperationAncestorsInputSchema = z.object({
  runId: z.uuid(),
  operationId: z.uuid(),
});

export const getOperationAncestorsOutputSchema = z.object({
  operations: z.array(
    z.object({
      id: z.uuid(),
      runId: z.uuid(),
      operationIndex: z.number().int().positive(),
      operationType: runOperationTypeSchema,
      parentOperationId: z.uuid().nullable(),
      supersedesOperationId: z.uuid().nullable(),
      documentId: z.uuid().nullable(),
      parametersJson: z.unknown(),
      actorType: runOperationActorTypeSchema,
      actorId: z.uuid().nullable(),
      createdAt: z.date(),
    }),
  ),
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
  captures: z.array(
    z.object({
      id: z.uuid(),
      captureType: z.string(),
      payloadJson: z.unknown(),
      summaryText: z.string().nullable(),
      createdAt: z.date(),
    }),
  ),
});

// ── runs listing ──────────────────────────────────────────────────────────────

export const getRunsBySnapshotInputSchema = z.object({
  snapshotId: z.uuid(),
  limit: z.number().int().positive().max(100).optional(),
});

export const getRunsBySnapshotOutputSchema = z.object({
  runs: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      status: runStatusSchema,
      createdByName: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  ),
});

