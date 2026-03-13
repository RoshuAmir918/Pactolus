import { z } from "zod";

export const getColumnMappingHintsInputSchema = z.object({
  snapshotId: z.uuid(),
  targetColumns: z.array(z.string().min(1)).min(1),
  maxSuggestionsPerColumn: z.number().int().positive().max(3).default(1),
});

export const hintMatchMethodSchema = z.enum([
  "exact",
  "substring",
  "token_overlap",
  "none",
]);

export const getColumnMappingHintsOutputSchema = z.object({
  hints: z.array(
    z.object({
      targetColumn: z.string(),
      suggestions: z.array(
        z.object({
          sourceColumn: z.string(),
          confidence: z.number().min(0).max(1),
          sourceContextDocumentId: z.uuid(),
          matchMethod: hintMatchMethodSchema,
        }),
      ),
    }),
  ),
});
