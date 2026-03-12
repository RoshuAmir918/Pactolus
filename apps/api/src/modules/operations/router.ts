import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  appendStepInputSchema,
  appendStepOutputSchema,
  createBranchInputSchema,
  createBranchOutputSchema,
  createRunInputSchema,
  createRunOutputSchema,
  getBranchEffectiveHistoryInputSchema,
  getBranchEffectiveHistoryOutputSchema,
  getRunBranchesInputSchema,
  getRunBranchesOutputSchema,
} from "./schemas";
import { appendStep, type AppendStepResult } from "./services/appendStep";
import { createBranch, type CreateBranchResult } from "./services/createBranch";
import { createRun, type CreateRunResult } from "./services/createRun";
import {
  getBranchEffectiveHistory,
  type GetBranchEffectiveHistoryResult,
} from "./services/getBranchEffectiveHistory";
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

  appendStep: authenticatedProcedure
    .input(appendStepInputSchema)
    .output(appendStepOutputSchema)
    .mutation(async ({ ctx, input }): Promise<AppendStepResult> =>
      appendStep({
        orgId: ctx.orgId,
        userId: ctx.userId,
        runId: input.runId,
        branchId: input.branchId,
        snapshotInputId: input.snapshotInputId,
        stepType: input.stepType,
        idempotencyKey: input.idempotencyKey,
        parentStepId: input.parentStepId,
        supersedesStepId: input.supersedesStepId,
        parametersJson: input.parametersJson,
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
