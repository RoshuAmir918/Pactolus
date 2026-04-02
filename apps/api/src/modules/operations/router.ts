import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  appendOperationInputSchema,
  appendOperationOutputSchema,
  createRunInputSchema,
  createRunOutputSchema,
  getOperationAncestorsInputSchema,
  getOperationAncestorsOutputSchema,
  getOperationCapturesInputSchema,
  getOperationCapturesOutputSchema,
  getRunOperationsInputSchema,
  getRunOperationsOutputSchema,
  getRunsBySnapshotInputSchema,
  getRunsBySnapshotOutputSchema,
  saveOperationCaptureInputSchema,
  saveOperationCaptureOutputSchema,
} from "./schemas";
import { appendOperation, type AppendOperationResult } from "./services/appendOperation";
import { createRun, type CreateRunResult } from "./services/createRun";
import { getOperationAncestors, type GetOperationAncestorsResult } from "./services/getOperationAncestors";
import { getRunOperations, type GetRunOperationsResult } from "./services/getRunOperations";
import { getRunsBySnapshot, type GetRunsBySnapshotResult } from "./services/getRunsBySnapshot";
import { saveOperationCapture, type SaveOperationCaptureResult } from "./services/saveOperationCapture";
import { getOperationCaptures, type GetOperationCapturesResult } from "./services/getOperationCaptures";

export const operationsRouter = router({
  createRun: authenticatedProcedure
    .input(createRunInputSchema)
    .output(createRunOutputSchema)
    .mutation(async ({ ctx, input }): Promise<CreateRunResult> =>
      createRun({ orgId: ctx.orgId, userId: ctx.userId, snapshotId: input.snapshotId, name: input.name }),
    ),

  appendOperation: authenticatedProcedure
    .input(appendOperationInputSchema)
    .output(appendOperationOutputSchema)
    .mutation(async ({ ctx, input }): Promise<AppendOperationResult> =>
      appendOperation({
        orgId: ctx.orgId,
        userId: ctx.userId,
        runId: input.runId,
        documentId: input.documentId,
        operationType: input.operationType,
        idempotencyKey: input.idempotencyKey,
        parentOperationId: input.parentOperationId,
        supersedesOperationId: input.supersedesOperationId,
        parametersJson: input.parametersJson,
      }),
    ),

  getRunOperations: authenticatedProcedure
    .input(getRunOperationsInputSchema)
    .output(getRunOperationsOutputSchema)
    .query(async ({ ctx, input }): Promise<GetRunOperationsResult> =>
      getRunOperations({ orgId: ctx.orgId, runId: input.runId }),
    ),

  getOperationAncestors: authenticatedProcedure
    .input(getOperationAncestorsInputSchema)
    .output(getOperationAncestorsOutputSchema)
    .query(async ({ ctx, input }): Promise<GetOperationAncestorsResult> =>
      getOperationAncestors({ orgId: ctx.orgId, runId: input.runId, operationId: input.operationId }),
    ),

  saveOperationCapture: authenticatedProcedure
    .input(saveOperationCaptureInputSchema)
    .output(saveOperationCaptureOutputSchema)
    .mutation(async ({ ctx, input }): Promise<SaveOperationCaptureResult> =>
      saveOperationCapture({
        orgId: ctx.orgId,
        runId: input.runId,
        runOperationId: input.runOperationId,
        captureType: input.captureType,
        payloadJson: input.payloadJson,
        summaryText: input.summaryText,
      }),
    ),

  getOperationCaptures: authenticatedProcedure
    .input(getOperationCapturesInputSchema)
    .output(getOperationCapturesOutputSchema)
    .query(async ({ ctx, input }): Promise<GetOperationCapturesResult> =>
      getOperationCaptures({ orgId: ctx.orgId, runId: input.runId, operationId: input.operationId }),
    ),

  getRunsBySnapshot: authenticatedProcedure
    .input(getRunsBySnapshotInputSchema)
    .output(getRunsBySnapshotOutputSchema)
    .query(async ({ ctx, input }): Promise<GetRunsBySnapshotResult> =>
      getRunsBySnapshot({ orgId: ctx.orgId, snapshotId: input.snapshotId, limit: input.limit }),
    ),
});

export type OperationsRouter = typeof operationsRouter;
