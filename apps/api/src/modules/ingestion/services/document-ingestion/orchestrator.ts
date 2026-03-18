import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverAndExtract } from "@api/modules/ingestion/services/discovery/discoverAndExtract";
import { processDeterministicBranch } from "./branches/claimsPolicies";
import { processContractBranch, shouldAllowClaudeDocument } from "./branches/contracts";
import { processTriangleBranch } from "./branches/triangles";
import { classifyWorkbookWithClaude } from "./classification/workbookClassifier";
import { ensureAnthropicFileRegistered } from "./files/anthropicFiles";
import { downloadFileToTemp } from "./files/download";
import {
  assertDocumentReady,
  clearTrianglesAndInsights,
  getDocumentIngestionStatus,
  getTargetDocument,
  setDocumentClassificationFromRouting,
  setDocumentCompleted,
  setDocumentFailed,
  setDocumentPending,
  updateDocumentSearchText,
} from "./persistence/documentsRepo";
import { applyClaudeSheetClassifications, upsertSheetsFromDeterministic } from "./persistence/sheetsRepo";
import { inferFileExtension, toErrorText } from "./shared/helpers";
import type {
  DocumentIngestionStatusResult,
  GetDocumentIngestionStatusInput,
  StartDocumentIngestionInput,
} from "./shared/types";

export async function startDocumentIngestion(
  input: StartDocumentIngestionInput,
): Promise<DocumentIngestionStatusResult> {
  const debugClaimsEnabled = process.env.INGESTION_DEBUG_CLAIMS === "1";
  const target = await getTargetDocument(input);
  assertDocumentReady(target.fileStatus, target.deletedAt);

  await setDocumentPending(target.documentId);

  const tempDir = await mkdtemp(join(tmpdir(), "pactolus-ingest-"));
  try {
    const localFilePath = await downloadFileToTemp({
      tempDir,
      bucket: target.bucket,
      objectKey: target.objectKey,
      fileName: target.filename,
    });

    const deterministic = await discoverAndExtract({
      filePath: localFilePath,
      fileExtension: target.fileExtension ?? inferFileExtension(target.filename),
    });
    if (debugClaimsEnabled) {
      const aggregateStats =
        deterministic.deterministic &&
        deterministic.deterministic.aggregateStats &&
        typeof deterministic.deterministic.aggregateStats === "object"
          ? (deterministic.deterministic.aggregateStats as Record<string, unknown>)
          : {};
      console.info("[ingestion.claims.routing.deterministic]", {
        documentId: target.documentId,
        fileName: target.filename,
        deterministicRoute: deterministic.route,
        deterministicDocumentType: deterministic.document.documentType,
        deterministicAiClassification: deterministic.document.aiClassification,
        sourceSheet: aggregateStats.sourceSheet ?? null,
        topSheetCandidates: Array.isArray(aggregateStats.sheetSelectionDiagnostics)
          ? aggregateStats.sheetSelectionDiagnostics.slice(0, 3)
          : [],
      });
    }

    await ensureAnthropicFileRegistered({
      target,
      deterministic,
      localFilePath,
    });

    await upsertSheetsFromDeterministic({
      target,
      deterministic,
    });

    const routing = await classifyWorkbookWithClaude({
      target,
      deterministic,
    });
    if (debugClaimsEnabled) {
      console.info("[ingestion.claims.routing.final]", {
        documentId: target.documentId,
        fileName: target.filename,
        claudeDocumentType: routing.documentType,
        claudeAiClassification: routing.aiClassification,
        sheetClassificationsCount: routing.sheetClassifications.length,
      });
    }
    await applyClaudeSheetClassifications(target.documentId, routing.sheetClassifications);
    await setDocumentClassificationFromRouting({
      documentId: target.documentId,
      documentType: routing.documentType,
      aiClassification: routing.aiClassification,
      aiConfidence: routing.aiConfidence,
    });
    await updateDocumentSearchText(target.documentId, deterministic.document.searchText ?? null);

    await clearTrianglesAndInsights(target.documentId);

    if (routing.documentType === "claims" || routing.documentType === "policies") {
      await processDeterministicBranch({
        target,
        deterministic,
      });
    } else if (routing.documentType === "loss_triangles") {
      await processTriangleBranch({
        target,
        deterministic,
      });
    } else {
      await processContractBranch({
        target,
        deterministic,
        localFilePath,
      });
    }

    await setDocumentCompleted(target.documentId);
  } catch (error) {
    await setDocumentFailed(target.documentId, toErrorText(error));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return getDocumentIngestionStatus(input);
}

export { getDocumentIngestionStatus };

export const ingestionGuardrails = {
  shouldAllowClaudeDocument,
};
