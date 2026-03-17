import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  createSnapshotInputSchema,
  createSnapshotOutputSchema,
} from "./schemas";
import { createSnapshot, type CreateSnapshotResult } from "./services/createSnapshot";

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

});

export type IngestionRouter = typeof ingestionRouter;
