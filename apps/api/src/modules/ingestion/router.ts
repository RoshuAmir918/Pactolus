import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  createSnapshotInputSchema,
  createSnapshotOutputSchema,
  getDocumentIngestionStatusInputSchema,
  getDocumentIngestionStatusOutputSchema,
  startDocumentIngestionInputSchema,
  startDocumentIngestionOutputSchema,
} from "./schemas";
import { createSnapshot, type CreateSnapshotResult } from "./services/createSnapshot";
import {
  getDocumentIngestionStatus,
  startDocumentIngestion,
} from "./services/document-ingestion/orchestrator";
import type { DocumentIngestionStatusResult } from "./services/document-ingestion/shared/types";
import { assertSnapshotAccess } from "@api/modules/guards/services/assertSnapshotAccess";

export const ingestionRouter = router({
  createSnapshot: authenticatedProcedure
    .input(createSnapshotInputSchema)
    .output(createSnapshotOutputSchema)
    .mutation(
      async ({ ctx, input }): Promise<CreateSnapshotResult> =>
        createSnapshot({
          orgId: ctx.orgId,
          userId: ctx.userId,
          clientId: input.clientId,
          label: input.label,
          accountingPeriod: input.accountingPeriod,
        }),
    ),


  startDocumentIngestion: authenticatedProcedure
    .input(startDocumentIngestionInputSchema)
    .output(startDocumentIngestionOutputSchema)
    .mutation(async ({ ctx, input }): Promise<DocumentIngestionStatusResult> => {
      await assertSnapshotAccess({
        snapshotId: input.snapshotId,
        orgId: ctx.orgId,
      });

      return startDocumentIngestion({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        documentId: input.documentId,
      });
    }),

  getDocumentIngestionStatus: authenticatedProcedure
    .input(getDocumentIngestionStatusInputSchema)
    .output(getDocumentIngestionStatusOutputSchema)
    .query(async ({ ctx, input }): Promise<DocumentIngestionStatusResult> => {
      await assertSnapshotAccess({
        snapshotId: input.snapshotId,
        orgId: ctx.orgId,
      });

      return getDocumentIngestionStatus({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        documentId: input.documentId,
      });
    }),

});

export type IngestionRouter = typeof ingestionRouter;
