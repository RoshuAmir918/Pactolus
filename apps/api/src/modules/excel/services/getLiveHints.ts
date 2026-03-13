import { getLiveHintsFromAi, type GetLiveHintsFromAiResult } from "./getLiveHintsFromAi";

export type GetLiveHintsInput = {
  orgId: string;
  snapshotId: string;
  targetColumns: string[];
  maxSuggestionsPerColumn: number;
  sheetSlice: {
    workbookName?: string;
    sheetName: string;
    selectedAddress: string;
    headers: string[];
    sampleRows?: string[][];
  };
};

export type GetLiveHintsResult = {
  source: "context_ai";
  hints: Array<{
    targetColumn: string;
    suggestions: Array<{
      sourceColumn: string;
      confidence: number;
      sourceContextDocumentId: string | null;
      matchMethod: "semantic_ai";
    }>;
  }>;
};

export async function getLiveHints(input: GetLiveHintsInput): Promise<GetLiveHintsResult> {
  const aiHints = await getLiveHintsFromAi({
    orgId: input.orgId,
    snapshotId: input.snapshotId,
    targetColumns: input.targetColumns,
    maxSuggestionsPerColumn: input.maxSuggestionsPerColumn,
    sheetSlice: input.sheetSlice,
  });

  return {
    source: "context_ai",
    hints: aiHints.hints,
  };
}
