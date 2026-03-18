import type { DiscoverAndExtractResult } from "../../discovery/discoverAndExtract";
import { callClaudeTool } from "../anthropic/client";
import {
  buildNarrativePrompt,
  buildWorkbookClassificationPrompt,
} from "../anthropic/prompts";
import { NARRATIVE_TOOL, WORKBOOK_CLASSIFICATION_TOOL } from "../anthropic/tools";
import { asEnum, asInteger, asString, toConfidence } from "../shared/parsers";
import type { ClaudeWorkbookRoutingResult, TargetDocument } from "../shared/types";

export async function classifyWorkbookWithClaude(input: {
  target: TargetDocument;
  deterministic: DiscoverAndExtractResult;
}): Promise<ClaudeWorkbookRoutingResult> {
  const parsed = await callClaudeTool<{
    documentType?: unknown;
    aiClassification?: unknown;
    aiConfidence?: unknown;
    sheetClassifications?: unknown;
  }>({
    prompt: buildWorkbookClassificationPrompt({
      fileName: input.target.filename,
      deterministicDocument: input.deterministic.document,
      deterministicSheets: input.deterministic.sheets,
    }),
    tool: WORKBOOK_CLASSIFICATION_TOOL,
    snapshotId: input.target.snapshotId,
    includeSnapshotFiles: true,
    maxTokens: 1200,
  });

  const sheetClassifications = Array.isArray(parsed.sheetClassifications)
    ? parsed.sheetClassifications
        .map((item) => {
          const sheetIndex = asInteger((item as { sheetIndex?: unknown }).sheetIndex);
          if (sheetIndex === null) {
            return null;
          }
          return {
            sheetIndex,
            sheetType:
              asEnum((item as { sheetType?: unknown }).sheetType, [
                "claims_like",
                "policies_like",
                "triangle_like",
                "tool_sheet",
                "other",
                "unknown",
              ] as const) ?? "unknown",
            aiClassification:
              asEnum((item as { aiClassification?: unknown }).aiClassification, [
                "claims_like",
                "policies_like",
                "triangle_like",
                "tool_sheet",
                "other",
                "unknown",
              ] as const) ?? "unknown",
            aiConfidence: toConfidence((item as { aiConfidence?: unknown }).aiConfidence),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  return {
    documentType:
      asEnum(parsed.documentType, [
        "claims",
        "policies",
        "loss_triangles",
        "workbook_tool",
        "other",
      ] as const) ?? "other",
    aiClassification:
      asEnum(parsed.aiClassification, [
        "claims",
        "policies",
        "loss_triangles",
        "workbook_tool",
        "other",
        "unknown",
      ] as const) ?? "unknown",
    aiConfidence: toConfidence(parsed.aiConfidence),
    sheetClassifications,
  };
}

export async function tryClaudeNarrative(input: {
  mode: "deterministic_summary" | "triangle_analysis";
  payload: unknown;
}): Promise<string | null> {
  try {
    const parsed = await callClaudeTool<{ narrative?: unknown }>({
      prompt: buildNarrativePrompt(input.mode, input.payload),
      tool: NARRATIVE_TOOL,
      maxTokens: 800,
    });
    return asString(parsed.narrative);
  } catch {
    return null;
  }
}
