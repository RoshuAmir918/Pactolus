import { z } from "zod";
import { runBranchStatusEnum, runOperationActorTypeEnum, runStatusEnum } from "@db/schema";

// Step type is now tool-defined and unconstrained by a platform enum.
export const runStepTypeSchema = z.string().trim().min(1);

export const runStepActorTypeSchema = z.enum(runOperationActorTypeEnum.enumValues);
export const runBranchStatusSchema = z.enum(runBranchStatusEnum.enumValues);
export const runStatusSchema = z.enum(runStatusEnum.enumValues);

export const createRunInputSchema = z.object({
  snapshotId: z.uuid(),
  name: z.string().min(1).optional(),
});

export const createRunOutputSchema = z.object({
  runId: z.uuid(),
  mainBranchId: z.uuid(),
  status: runStatusSchema,
});

export const createBranchInputSchema = z.object({
  runId: z.uuid(),
  name: z.string().min(1),
  parentBranchId: z.uuid().optional(),
  forkedFromStepId: z.uuid().optional(),
});

export const createBranchOutputSchema = z.object({
  branchId: z.uuid(),
  runId: z.uuid(),
  parentBranchId: z.uuid().nullable(),
  forkedFromStepId: z.uuid().nullable(),
  status: runBranchStatusSchema,
});

export const archiveBranchInputSchema = z.object({
  runId: z.uuid(),
  branchId: z.uuid(),
});

export const archiveBranchOutputSchema = z.object({
  branchId: z.uuid(),
  runId: z.uuid(),
  status: runBranchStatusSchema,
});

export const appendStepInputSchema = z.object({
  runId: z.uuid(),
  branchId: z.uuid().optional(),
  documentId: z.uuid().optional(),
  stepType: runStepTypeSchema,
  idempotencyKey: z.string().min(1).optional(),
  parentStepId: z.uuid().optional(),
  supersedesStepId: z.uuid().optional(),
  parametersJson: z.unknown(),
});

export const appendStepOutputSchema = z.object({
  stepId: z.uuid(),
  runId: z.uuid(),
  branchId: z.uuid(),
  stepIndex: z.number().int().positive(),
  stepType: runStepTypeSchema,
  actorType: runStepActorTypeSchema,
  actorId: z.uuid().nullable(),
});

export const getRunBranchesInputSchema = z.object({
  runId: z.uuid(),
});

export const getRunBranchesOutputSchema = z.object({
  branches: z.array(
    z.object({
      id: z.uuid(),
      runId: z.uuid(),
      parentBranchId: z.uuid().nullable(),
      forkedFromStepId: z.uuid().nullable(),
      name: z.string(),
      status: runBranchStatusSchema,
      createdByUserId: z.uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  ),
});

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

export const getBranchEffectiveHistoryInputSchema = z.object({
  runId: z.uuid(),
  branchId: z.uuid(),
});

export const getBranchEffectiveHistoryOutputSchema = z.object({
  lineageBranchIds: z.array(z.uuid()),
  steps: z.array(
    z.object({
      id: z.uuid(),
      runId: z.uuid(),
      branchId: z.uuid(),
      documentId: z.uuid().nullable(),
      stepIndex: z.number().int().positive(),
      parentStepId: z.uuid().nullable(),
      stepType: runStepTypeSchema,
      actorType: runStepActorTypeSchema,
      actorId: z.uuid().nullable(),
      idempotencyKey: z.string().nullable(),
      parametersJson: z.unknown(),
      supersedesStepId: z.uuid().nullable(),
      createdAt: z.date(),
    }),
  ),
});

export const completeBranchInputSchema = z.object({
  runId: z.uuid(),
  branchId: z.uuid(),
  idempotencyKey: z.string().min(1).optional(),
  generateAiSummary: z.boolean().optional(),
});

const assumptionValueSchema = z.object({
  valueJson: z.unknown(),
  confidence: z.number().min(0).max(1).nullable(),
  rationale: z.string().nullable(),
  sourceStepId: z.uuid(),
});

export const completeBranchOutputSchema = z.object({
  completionStepId: z.uuid(),
  runId: z.uuid(),
  branchId: z.uuid(),
  branchStatus: runBranchStatusSchema,
  assumptionDiff: z.object({
    baselineCount: z.number().int().nonnegative(),
    finalCount: z.number().int().nonnegative(),
    added: z.array(
      z.object({
        assumptionKey: z.string(),
        after: assumptionValueSchema,
      }),
    ),
    removed: z.array(
      z.object({
        assumptionKey: z.string(),
        before: assumptionValueSchema,
      }),
    ),
    modified: z.array(
      z.object({
        assumptionKey: z.string(),
        before: assumptionValueSchema,
        after: assumptionValueSchema,
        changedFields: z.array(z.enum(["value", "confidence", "rationale"])),
      }),
    ),
  }),
  aiSummary: z
    .object({
      summary: z.string(),
      notableChanges: z.array(z.string()),
      confidence: z.number().min(0).max(1).nullable(),
    })
    .nullable(),
});
