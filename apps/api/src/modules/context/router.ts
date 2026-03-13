import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  getColumnMappingHintsInputSchema,
  getColumnMappingHintsOutputSchema,
} from "./schemas";
import {
  getColumnMappingHints,
  type GetColumnMappingHintsResult,
} from "./services/getColumnMappingHints";

export const contextRouter = router({
  getColumnMappingHints: authenticatedProcedure
    .input(getColumnMappingHintsInputSchema)
    .output(getColumnMappingHintsOutputSchema)
    .query(async ({ ctx, input }): Promise<GetColumnMappingHintsResult> =>
      getColumnMappingHints({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        targetColumns: input.targetColumns,
        maxSuggestionsPerColumn: input.maxSuggestionsPerColumn,
      }),
    ),
});

export type ContextRouter = typeof contextRouter;
