import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  confirmMappingInputSchema,
  confirmMappingOutputSchema,
  createSnapshotInputSchema,
  createSnapshotOutputSchema,
  uploadBatchCsvInputSchema,
  uploadBatchCsvOutputSchema,
  uploadCsvInputSchema,
  uploadCsvOutputSchema,
} from "./schemas";
import { createSnapshot, type CreateSnapshotResult } from "./services/createSnapshot";
import {
  type UploadCsvToSnapshotResult,
  uploadCsvToSnapshot,
  uploadCsvFiles,
} from "./services/uploadCsv";

export const ingestionRouter = router({
  createSnapshot: authenticatedProcedure
    .input(createSnapshotInputSchema)
    .output(createSnapshotOutputSchema)
    .mutation(
      async ({ ctx, input }): Promise<CreateSnapshotResult> =>
        createSnapshot({
          orgId: ctx.orgId,
          userId: ctx.userId,
          label: input.label,
          accountingPeriod: input.accountingPeriod,
        }),
    ),

  uploadClaimsCsv: authenticatedProcedure
    .input(uploadCsvInputSchema)
    .output(uploadCsvOutputSchema)
    .mutation(
      async ({ ctx, input }): Promise<UploadCsvToSnapshotResult> =>
        uploadCsvToSnapshot({
          orgId: ctx.orgId,
          userId: ctx.userId,
          snapshotId: input.snapshotId,
          fileName: input.fileName,
          csvText: input.csvText,
          entityType: "claim",
        }),
    ),

  uploadPoliciesCsv: authenticatedProcedure
    .input(uploadCsvInputSchema)
    .output(uploadCsvOutputSchema)
    .mutation(
      async ({ ctx, input }): Promise<UploadCsvToSnapshotResult> =>
        uploadCsvToSnapshot({
          orgId: ctx.orgId,
          userId: ctx.userId,
          snapshotId: input.snapshotId,
          fileName: input.fileName,
          csvText: input.csvText,
          entityType: "policy",
        }),
    ),

  uploadCsvFiles: authenticatedProcedure
    .input(uploadBatchCsvInputSchema)
    .output(uploadBatchCsvOutputSchema)
    .mutation(async ({ ctx, input }) =>
      uploadCsvFiles({
        orgId: ctx.orgId,
        userId: ctx.userId,
        snapshotId: input.snapshotId,
        files: input.files,
      }),
    ),

});

export type IngestionRouter = typeof ingestionRouter;
