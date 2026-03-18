import type { DiscoverAndExtractResult } from "../../discovery/discoverAndExtract";
import { callClaudeTool } from "../anthropic/client";
import { buildContractPrompt } from "../anthropic/prompts";
import { CONTRACT_EXTRACTION_TOOL } from "../anthropic/tools";
import { buildClaudeContractContent } from "../contracts/content";
import { insertInsights } from "../persistence/insightsRepo";
import { updateDocumentSearchText } from "../persistence/documentsRepo";
import { asString } from "../shared/parsers";
import type { TargetDocument } from "../shared/types";

const MAX_CLAUDE_CONTRACT_FILE_BYTES = 8 * 1024 * 1024;

export function shouldAllowClaudeDocument(fileSizeBytes: number): boolean {
  return fileSizeBytes <= MAX_CLAUDE_CONTRACT_FILE_BYTES;
}

export async function processContractBranch(input: {
  target: TargetDocument;
  deterministic: DiscoverAndExtractResult;
  localFilePath: string;
}) {
  const { target, deterministic, localFilePath } = input;
  if (!shouldAllowClaudeDocument(target.fileSizeBytes)) {
    throw new Error(
      `Contract-style files above ${MAX_CLAUDE_CONTRACT_FILE_BYTES} bytes are blocked from raw Claude submission`,
    );
  }

  const content = await buildClaudeContractContent({
    localFilePath,
    mimeType: target.mimeType,
  });
  const parsed = await callClaudeTool<{
    contractTerms?: unknown;
    narrative?: unknown;
    searchText?: unknown;
  }>({
    prompt: buildContractPrompt({
      fileName: target.filename,
      mimeType: target.mimeType,
      deterministicContext: {
        document: deterministic.document,
        sheets: deterministic.sheets.slice(0, 8),
        deterministic: deterministic.deterministic,
      },
      supplementalText: content.supplementalText,
    }),
    tool: CONTRACT_EXTRACTION_TOOL,
    contentBlocks: content.contentBlocks,
    snapshotId: target.snapshotId,
    includeSnapshotFiles: true,
    maxTokens: 1800,
  });

  await updateDocumentSearchText(target.documentId, asString(parsed.searchText) ?? null);

  await insertInsights(target, [
    {
      insightType: "contract_terms",
      title: "Contract Terms",
      payloadJson: parsed.contractTerms ?? {},
      confidence: "0.8000",
    },
    {
      insightType: "narrative",
      title: "Contract Narrative",
      payloadJson: { narrative: asString(parsed.narrative) ?? "" },
      confidence: "0.7500",
    },
  ]);
}
