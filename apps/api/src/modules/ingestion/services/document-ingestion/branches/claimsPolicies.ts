import type { DiscoverAndExtractResult } from "../../discovery/discoverAndExtract";
import { tryClaudeNarrative } from "../classification/workbookClassifier";
import { insertInsights } from "../persistence/insightsRepo";
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
  await insertInsights(target, [
    {
      insightType: "segment_manifest",
      title: "Segment Manifest",
      payloadJson: deterministicPayload.segmentManifest,
      confidence: "0.9500",
    },
    {
      insightType: "aggregate_stats",
      title: "Aggregate Statistics",
      payloadJson: deterministicPayload.aggregateStats,
      confidence: "0.9500",
    },
    {
      insightType: "quality_flags",
      title: "Quality Flags",
      payloadJson: deterministicPayload.qualityFlags,
      confidence: "0.9000",
    },
  ]);

  const narrative = await tryClaudeNarrative({
    mode: "deterministic_summary",
    payload: {
      document: deterministic.document,
      aggregateStats: deterministicPayload.aggregateStats,
      qualityFlags: deterministicPayload.qualityFlags,
      segmentManifestSample: deterministicPayload.segmentManifest?.slice(0, 10),
    },
  });
  if (narrative) {
    if (debugClaimsEnabled) {
      console.info("[ingestion.claims.narrative]", {
        documentId: target.documentId,
        narrativeLength: narrative.length,
      });
    }
    await insertInsights(target, [
      {
        insightType: "narrative",
        title: "Dataset Narrative",
        payloadJson: {
          narrative,
        },
        confidence: "0.8000",
      },
    ]);
  } else if (debugClaimsEnabled) {
    console.warn("[ingestion.claims.narrative]", {
      documentId: target.documentId,
      message: "No narrative returned from deterministic_summary",
    });
  }
}
