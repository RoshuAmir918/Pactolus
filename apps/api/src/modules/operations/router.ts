import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  analyzeComparisonInputSchema,
  analyzeComparisonOutputSchema,
  appendOperationInputSchema,
  appendOperationOutputSchema,
  createRunInputSchema,
  createRunOutputSchema,
  generateOperationLabelInputSchema,
  generateOperationLabelOutputSchema,
  getOperationAncestorsInputSchema,
  getOperationAncestorsOutputSchema,
  getOperationCapturesInputSchema,
  getOperationCapturesOutputSchema,
  getOperationNoteInputSchema,
  getOperationNoteOutputSchema,
  getRunOperationsInputSchema,
  getRunOperationsOutputSchema,
  getRunBranchesInputSchema,
  getRunBranchesOutputSchema,
  getRunsBySnapshotInputSchema,
  getRunsBySnapshotOutputSchema,
  saveOperationCaptureInputSchema,
  saveOperationCaptureOutputSchema,
  setOperationNoteInputSchema,
  setOperationNoteOutputSchema,
} from "./schemas";
import { analyzeComparison, type AnalyzeComparisonResult } from "./services/analyzeComparison";
import { appendOperation, type AppendOperationResult } from "./services/appendOperation";
import { createRun, type CreateRunResult } from "./services/createRun";
import { generateOperationLabel, type GenerateOperationLabelResult } from "./services/generateOperationLabel";
import { getOperationNote, type GetOperationNoteResult } from "./services/getOperationNote";
import { setOperationNote, type SetOperationNoteResult } from "./services/setOperationNote";
import { getOperationAncestors, type GetOperationAncestorsResult } from "./services/getOperationAncestors";
import { getRunOperations, type GetRunOperationsResult } from "./services/getRunOperations";
import { getRunBranches, type GetRunBranchesResult } from "./services/getRunBranches";
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

  setOperationNote: authenticatedProcedure
    .input(setOperationNoteInputSchema)
    .output(setOperationNoteOutputSchema)
    .mutation(async ({ ctx, input }): Promise<SetOperationNoteResult> =>
      setOperationNote({
        orgId: ctx.orgId,
        userId: ctx.userId,
        runId: input.runId,
        operationId: input.operationId,
        noteText: input.noteText,
      }),
    ),

  getOperationNote: authenticatedProcedure
    .input(getOperationNoteInputSchema)
    .output(getOperationNoteOutputSchema)
    .query(async ({ ctx, input }): Promise<GetOperationNoteResult> =>
      getOperationNote({ orgId: ctx.orgId, runId: input.runId, operationId: input.operationId }),
    ),

  analyzeComparison: authenticatedProcedure
    .input(analyzeComparisonInputSchema)
    .output(analyzeComparisonOutputSchema)
    .mutation(async ({ ctx, input }): Promise<AnalyzeComparisonResult> =>
      analyzeComparison({ orgId: ctx.orgId, runId: input.runId, operationIds: input.operationIds }),
    ),

  generateOperationLabel: authenticatedProcedure
    .input(generateOperationLabelInputSchema)
    .output(generateOperationLabelOutputSchema)
    .mutation(async ({ ctx, input }): Promise<GenerateOperationLabelResult> =>
      generateOperationLabel({ orgId: ctx.orgId, runId: input.runId, operationId: input.operationId }),
    ),

  getRunBranches: authenticatedProcedure
    .input(getRunBranchesInputSchema)
    .output(getRunBranchesOutputSchema)
    .query(async ({ ctx, input }): Promise<GetRunBranchesResult> =>
      getRunBranches({ orgId: ctx.orgId, runId: input.runId }),
    ),

  getRunsBySnapshot: authenticatedProcedure
    .input(getRunsBySnapshotInputSchema)
    .output(getRunsBySnapshotOutputSchema)
    .query(async ({ ctx, input }): Promise<GetRunsBySnapshotResult> =>
      getRunsBySnapshot({ orgId: ctx.orgId, snapshotId: input.snapshotId, limit: input.limit }),
    ),
});

export type OperationsRouter = typeof operationsRouter;
