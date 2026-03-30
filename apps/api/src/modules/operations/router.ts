import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  archiveBranchInputSchema,
  archiveBranchOutputSchema,
  appendStepInputSchema,
  appendStepOutputSchema,
  completeBranchInputSchema,
  completeBranchOutputSchema,
  createBranchInputSchema,
  createBranchOutputSchema,
  createRunInputSchema,
  createRunOutputSchema,
  getBranchEffectiveHistoryInputSchema,
  getBranchEffectiveHistoryOutputSchema,
  getRunsBySnapshotInputSchema,
  getRunsBySnapshotOutputSchema,
  getRunBranchesInputSchema,
  getRunBranchesOutputSchema,
} from "./schemas";
import {
  archiveBranch,
  type ArchiveBranchResult,
} from "./services/archiveBranch";
import { appendStep, type AppendStepResult } from "./services/appendStep";
import {
  completeBranch,
  type CompleteBranchResult,
} from "./services/completeBranch";
import { createBranch, type CreateBranchResult } from "./services/createBranch";
import { createRun, type CreateRunResult } from "./services/createRun";
import {
  getBranchEffectiveHistory,
  type GetBranchEffectiveHistoryResult,
} from "./services/getBranchEffectiveHistory";
import {
  getRunsBySnapshot,
  type GetRunsBySnapshotResult,
} from "./services/getRunsBySnapshot";
import { getRunBranches, type GetRunBranchesResult } from "./services/getRunBranches";

export const operationsRouter = router({
  createRun: authenticatedProcedure
    .input(createRunInputSchema)
    .output(createRunOutputSchema)
    .mutation(async ({ ctx, input }): Promise<CreateRunResult> =>
      createRun({
        orgId: ctx.orgId,
        userId: ctx.userId,
        snapshotId: input.snapshotId,
        name: input.name,
      }),
    ),

  createBranch: authenticatedProcedure
    .input(createBranchInputSchema)
    .output(createBranchOutputSchema)
    .mutation(async ({ ctx, input }): Promise<CreateBranchResult> =>
      createBranch({
        orgId: ctx.orgId,
        userId: ctx.userId,
        runId: input.runId,
        name: input.name,
        parentBranchId: input.parentBranchId,
        forkedFromStepId: input.forkedFromStepId,
      }),
    ),

  archiveBranch: authenticatedProcedure
    .input(archiveBranchInputSchema)
    .output(archiveBranchOutputSchema)
    .mutation(async ({ ctx, input }): Promise<ArchiveBranchResult> =>
      archiveBranch({
        orgId: ctx.orgId,
        runId: input.runId,
        branchId: input.branchId,
      }),
    ),

  appendStep: authenticatedProcedure
    .input(appendStepInputSchema)
    .output(appendStepOutputSchema)
    .mutation(async ({ ctx, input }): Promise<AppendStepResult> =>
      appendStep({
        orgId: ctx.orgId,
        userId: ctx.userId,
        runId: input.runId,
        branchId: input.branchId,
        documentId: input.documentId,
        stepType: input.stepType,
        idempotencyKey: input.idempotencyKey,
        parentStepId: input.parentStepId,
        supersedesStepId: input.supersedesStepId,
        parametersJson: input.parametersJson,
      }),
    ),

  completeBranch: authenticatedProcedure
    .input(completeBranchInputSchema)
    .output(completeBranchOutputSchema)
    .mutation(async ({ ctx, input }): Promise<CompleteBranchResult> =>
      completeBranch({
        orgId: ctx.orgId,
        userId: ctx.userId,
        runId: input.runId,
        branchId: input.branchId,
        idempotencyKey: input.idempotencyKey,
        generateAiSummary: input.generateAiSummary,
      }),
    ),

  getRunBranches: authenticatedProcedure
    .input(getRunBranchesInputSchema)
    .output(getRunBranchesOutputSchema)
    .query(async ({ ctx, input }): Promise<GetRunBranchesResult> =>
      getRunBranches({
        orgId: ctx.orgId,
        runId: input.runId,
      }),
    ),

  getRunsBySnapshot: authenticatedProcedure
    .input(getRunsBySnapshotInputSchema)
    .output(getRunsBySnapshotOutputSchema)
    .query(async ({ ctx, input }): Promise<GetRunsBySnapshotResult> =>
      getRunsBySnapshot({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        limit: input.limit,
      }),
    ),

  getBranchEffectiveHistory: authenticatedProcedure
    .input(getBranchEffectiveHistoryInputSchema)
    .output(getBranchEffectiveHistoryOutputSchema)
    .query(async ({ ctx, input }): Promise<GetBranchEffectiveHistoryResult> =>
      getBranchEffectiveHistory({
        orgId: ctx.orgId,
        runId: input.runId,
        branchId: input.branchId,
      }),
    ),
});

export type OperationsRouter = typeof operationsRouter;
