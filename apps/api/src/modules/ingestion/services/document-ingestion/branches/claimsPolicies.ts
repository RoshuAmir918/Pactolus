import type { DiscoverAndExtractResult } from "../../discovery/discoverAndExtract";
import type { TargetDocument } from "../shared/types";

export async function processDeterministicBranch(input: {
  target: TargetDocument;
  deterministic: DiscoverAndExtractResult;
}) {
  const { target, deterministic } = input;
  const debugClaimsEnabled = process.env.INGESTION_DEBUG_CLAIMS === "1";

  const deterministicPayload = deterministic.deterministic;
  if (debugClaimsEnabled) {
    const aggregateStats =
      deterministicPayload.aggregateStats && typeof deterministicPayload.aggregateStats === "object"
        ? (deterministicPayload.aggregateStats as Record<string, unknown>)
        : {};
    const numericColumns =
      aggregateStats.numericColumns && typeof aggregateStats.numericColumns === "object"
        ? (aggregateStats.numericColumns as Record<string, unknown>)
        : {};
    console.info("[ingestion.claims.deterministic]", {
      documentId: target.documentId,
      route: deterministic.route,
      sourceSheet: aggregateStats.sourceSheet ?? null,
      rowCount: aggregateStats.rowCount ?? null,
      columnCount: aggregateStats.columnCount ?? null,
      numericColumnCount: Object.keys(numericColumns).length,
      segmentManifestDimensions: Array.isArray(deterministicPayload.segmentManifest)
        ? deterministicPayload.segmentManifest.length
        : 0,
      qualityFlagsCount: Array.isArray(deterministicPayload.qualityFlags)
        ? deterministicPayload.qualityFlags.length
        : 0,
      topSheetCandidates: Array.isArray(aggregateStats.sheetSelectionDiagnostics)
        ? aggregateStats.sheetSelectionDiagnostics.slice(0, 3)
        : [],
    });
  }
}
