import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  detectRegionsInputSchema,
  detectRegionsOutputSchema,
  detectWorkbookRegionsInputSchema,
  detectWorkbookRegionsOutputSchema,
  extractScenarioAssumptionsInputSchema,
  extractScenarioAssumptionsOutputSchema,
  ingestRegionEventInputSchema,
  ingestRegionEventOutputSchema,
} from "./schemas";
import {
  detectRegionsWithAi,
  type DetectRegionsWithAiResult,
} from "./services/detectRegionsWithAi";
import { detectWorkbookRegions } from "./services/detectWorkbookRegions";
import { extractScenarioAssumptions } from "./services/extractScenarioAssumptions";
import { ingestRegionEvent, type IngestRegionEventResult } from "./services/ingestRegionEvent";

export const excelRouter = router({
  detectWorkbookRegions: authenticatedProcedure
    .input(detectWorkbookRegionsInputSchema)
    .output(detectWorkbookRegionsOutputSchema)
    .mutation(async ({ ctx, input }) =>
      detectWorkbookRegions({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        sheets: input.sheets,
      }),
    ),

  extractScenarioAssumptions: authenticatedProcedure
    .input(extractScenarioAssumptionsInputSchema)
    .output(extractScenarioAssumptionsOutputSchema)
    .mutation(async ({ ctx, input }) =>
      extractScenarioAssumptions({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        sheets: input.sheets,
      }),
    ),

  detectRegions: authenticatedProcedure
    .input(detectRegionsInputSchema)
    .output(detectRegionsOutputSchema)
    .query(async ({ input }): Promise<{ source: "ai"; candidates: DetectRegionsWithAiResult["candidates"] }> => {
      const detected = await detectRegionsWithAi({
        sheetSlice: input.sheetSlice,
        maxRegionsPerType: input.maxRegionsPerType,
      });
      return {
        source: "ai",
        candidates: detected.candidates,
      };
    }),

  ingestRegionEvent: authenticatedProcedure
    .input(ingestRegionEventInputSchema)
    .output(ingestRegionEventOutputSchema)
    .mutation(async ({ ctx, input }): Promise<IngestRegionEventResult> =>
      ingestRegionEvent({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        sheetName: input.sheetName,
        address: input.address,
        eventType: input.eventType,
        detailsJson: input.detailsJson,
      }),
    ),
});

export type ExcelRouter = typeof excelRouter;
