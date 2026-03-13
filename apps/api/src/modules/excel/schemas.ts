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

export const monitoredRegionTypeSchema = z.enum(["input", "output"]);

export const monitoredRegionSchema = z.object({
  address: z.string().min(1),
  regionType: monitoredRegionTypeSchema,
  confidencePercent: z.number().int().min(0).max(100),
  userConfirmed: z.boolean().default(false),
  reason: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});

export const getLiveHintsInputSchema = z.object({
  snapshotId: z.uuid(),
  strategy: z.enum(["ai"]).default("ai"),
  targetColumns: z.array(z.string().min(1)).min(1),
  maxSuggestionsPerColumn: z.number().int().positive().max(5).default(1),
  sheetSlice: excelSheetSliceSchema,
});

export const getLiveHintsOutputSchema = z.object({
  source: z.literal("context_ai"),
  hints: z.array(
    z.object({
      targetColumn: z.string(),
      suggestions: z.array(
        z.object({
          sourceColumn: z.string(),
          confidence: z.number().min(0).max(1),
          sourceContextDocumentId: z.uuid().nullable(),
          matchMethod: z.literal("semantic_ai"),
        }),
      ),
    }),
  ),
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

export const saveMonitoredRegionsInputSchema = z.object({
  snapshotId: z.uuid(),
  sheetName: z.string().min(1),
  regions: z.array(monitoredRegionSchema).min(1),
});

export const saveMonitoredRegionsOutputSchema = z.object({
  regions: z.array(
    monitoredRegionSchema.extend({
      id: z.uuid(),
      snapshotId: z.uuid(),
      sheetName: z.string(),
      status: z.enum(["active", "archived"]),
    }),
  ),
});

export const getMonitoredRegionsInputSchema = z.object({
  snapshotId: z.uuid(),
  sheetName: z.string().min(1),
});

export const getMonitoredRegionsOutputSchema = z.object({
  regions: z.array(
    monitoredRegionSchema.extend({
      id: z.uuid(),
      snapshotId: z.uuid(),
      sheetName: z.string(),
      status: z.enum(["active", "archived"]),
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
