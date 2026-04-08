import { z } from "zod";

export const excelSheetSliceSchema = z.object({
  workbookName: z.string().min(1).optional(),
  sheetName: z.string().min(1),
  selectedAddress: z.string().min(1),
  rowCount: z.number().int().positive().optional(),
  columnCount: z.number().int().positive().optional(),
  headers: z.array(z.string()),
  sampleRows: z.array(z.array(z.string())).max(25).optional(),
});

export const monitoredRegionSchema = z.object({
  address: z.string().min(1),
  regionType: z.enum(["input", "output"]),
  confidencePercent: z.number().int().min(0).max(100),
  userConfirmed: z.boolean().default(false),
  reason: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});

export const detectRegionsInputSchema = z.object({
  snapshotId: z.uuid(),
  strategy: z.enum(["ai"]).default("ai"),
  sheetSlice: excelSheetSliceSchema,
  maxRegionsPerType: z.number().int().positive().max(5).default(2),
});

export const detectRegionsOutputSchema = z.object({
  source: z.literal("ai"),
  candidates: z.array(monitoredRegionSchema),
});

export const detectWorkbookRegionsInputSchema = z.object({
  snapshotId: z.string().min(1),
  sheets: z.array(
    z.object({
      sheetName: z.string().min(1),
      headers: z.array(z.string()),
      sampleRows: z.array(z.array(z.string())),
      regions: z.array(z.object({
        address: z.string(),
        type: z.string(),
        fontColor: z.string(),
      })).optional(),
      rowCount: z.number().int(),
      columnCount: z.number().int(),
    }),
  ).min(1).max(10),
});

const detectedRegionSchema = z.object({
  address: z.string(),
  description: z.string(),
  reason: z.string(),
  confidencePercent: z.number().int(),
  colHeaderAddress: z.string().optional(),
  rowHeaderAddress: z.string().optional(),
});

const detectedSheetSchema = z.object({
  sheetName: z.string(),
  inputRegions: z.array(detectedRegionSchema),
  outputRegions: z.array(detectedRegionSchema),
});

export const detectWorkbookRegionsOutputSchema = z.object({
  sheets: z.array(detectedSheetSchema),
  promptMessage: z.string().nullable(),
});

export const extractScenarioAssumptionsInputSchema = z.object({
  snapshotId: z.string().min(1),
  sheets: z.array(
    z.object({
      sheetName: z.string().min(1),
      headers: z.array(z.string()),
      sampleRows: z.array(z.array(z.string())),
      regions: z.array(z.object({
        address: z.string(),
        type: z.string(),
        fontColor: z.string(),
      })).optional(),
      rowCount: z.number().int(),
      columnCount: z.number().int(),
    }),
  ).min(1).max(10),
});

export const extractScenarioAssumptionsOutputSchema = z.object({
  assumptions: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      unit: z.string().nullable(),
      confidence: z.number(),
      rationale: z.string(),
    }),
  ),
});

export const ingestRegionEventInputSchema = z.object({
  snapshotId: z.uuid(),
  sheetName: z.string().min(1),
  address: z.string().min(1),
  eventType: z.enum(["input_change", "output_change"]),
  detailsJson: z.unknown().optional(),
});

export const ingestRegionEventOutputSchema = z.object({
  ok: z.literal(true),
  receivedAt: z.date(),
});
