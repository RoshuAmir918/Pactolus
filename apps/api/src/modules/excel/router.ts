import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  detectRegionsInputSchema,
  detectRegionsOutputSchema,
  detectWorkbookRegionsInputSchema,
  detectWorkbookRegionsOutputSchema,
  extractScenarioAssumptionsInputSchema,
  extractScenarioAssumptionsOutputSchema,
  getMonitoredRegionsInputSchema,
  getMonitoredRegionsOutputSchema,
ingestRegionEventInputSchema,
  ingestRegionEventOutputSchema,
  saveMonitoredRegionsInputSchema,
  saveMonitoredRegionsOutputSchema,
} from "./schemas";
import {
  detectRegionsWithAi,
  type DetectRegionsWithAiResult,
} from "./services/detectRegionsWithAi";
import { detectWorkbookRegions } from "./services/detectWorkbookRegions";
import { extractScenarioAssumptions } from "./services/extractScenarioAssumptions";
import {
  getMonitoredRegions,
  type GetMonitoredRegionsResult,
} from "./services/getMonitoredRegions";
import { ingestRegionEvent, type IngestRegionEventResult } from "./services/ingestRegionEvent";
import {
  saveMonitoredRegions,
  type SaveMonitoredRegionsResult,
} from "./services/saveMonitoredRegions";

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

  saveMonitoredRegions: authenticatedProcedure
    .input(saveMonitoredRegionsInputSchema)
    .output(saveMonitoredRegionsOutputSchema)
    .mutation(async ({ ctx, input }): Promise<SaveMonitoredRegionsResult> =>
      saveMonitoredRegions({
        orgId: ctx.orgId,
        userId: ctx.userId,
        snapshotId: input.snapshotId,
        sheetName: input.sheetName,
        regions: input.regions,
      }),
    ),

  getMonitoredRegions: authenticatedProcedure
    .input(getMonitoredRegionsInputSchema)
    .output(getMonitoredRegionsOutputSchema)
    .query(async ({ ctx, input }): Promise<GetMonitoredRegionsResult> =>
      getMonitoredRegions({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        sheetName: input.sheetName,
      }),
    ),

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
