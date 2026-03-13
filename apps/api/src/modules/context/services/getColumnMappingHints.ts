import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { contextDocuments, snapshots } from "@db/schema";

const { db } = dbClient;

type GetColumnMappingHintsInput = {
  orgId: string;
  snapshotId: string;
  targetColumns: string[];
  maxSuggestionsPerColumn: number;
};

type MatchMethod = "exact" | "substring" | "token_overlap" | "none";

type ColumnHintSuggestion = {
  sourceColumn: string;
  confidence: number;
  sourceContextDocumentId: string;
  matchMethod: Exclude<MatchMethod, "none">;
};

type ScoredCandidate = {
  sourceColumn: string;
  sourceContextDocumentId: string;
  confidence: number;
  matchMethod: MatchMethod;
};

export type GetColumnMappingHintsResult = {
  hints: Array<{
    targetColumn: string;
    suggestions: ColumnHintSuggestion[];
  }>;
};

export async function getColumnMappingHints(
  input: GetColumnMappingHintsInput,
): Promise<GetColumnMappingHintsResult> {
  const [snapshot] = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.orgId, input.orgId)))
    .limit(1);

  if (!snapshot) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Snapshot not found for this organization",
    });
  }

  const documents = await db
    .select({
      id: contextDocuments.id,
      truthTier: contextDocuments.truthTier,
      contentJson: contextDocuments.contentJson,
    })
    .from(contextDocuments)
    .where(
      and(
        eq(contextDocuments.orgId, input.orgId),
        eq(contextDocuments.snapshotId, input.snapshotId),
        eq(contextDocuments.status, "active"),
      ),
    )
    .orderBy(desc(contextDocuments.createdAt))
    .limit(200);

  const sourceColumns = collectSourceColumns(documents);
  const hints = input.targetColumns.map((targetColumn) => {
    const scored = sourceColumns
      .map((candidate) => scoreCandidate(targetColumn, candidate))
      .filter(isColumnHintSuggestion)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, input.maxSuggestionsPerColumn)
      .map((candidate) => ({
        sourceColumn: candidate.sourceColumn,
        confidence: candidate.confidence,
        sourceContextDocumentId: candidate.sourceContextDocumentId,
        matchMethod: candidate.matchMethod,
      }));

    return {
      targetColumn,
      suggestions: scored,
    };
  });

  return { hints };
}

function collectSourceColumns(
  documents: Array<{
    id: string;
    truthTier: "tier0" | "tier1" | "tier2" | "tier3";
    contentJson: unknown;
  }>,
): Array<{
  sourceColumn: string;
  sourceContextDocumentId: string;
  truthTier: "tier0" | "tier1" | "tier2" | "tier3";
}> {
  const collected: Array<{
    sourceColumn: string;
    sourceContextDocumentId: string;
    truthTier: "tier0" | "tier1" | "tier2" | "tier3";
  }> = [];

  for (const document of documents) {
    const columns = extractDetectedColumns(document.contentJson);
    for (const sourceColumn of columns) {
      collected.push({
        sourceColumn,
        sourceContextDocumentId: document.id,
        truthTier: document.truthTier,
      });
    }
  }

  return dedupeBestByColumn(collected);
}

function extractDetectedColumns(contentJson: unknown): string[] {
  if (!contentJson || typeof contentJson !== "object") {
    return [];
  }

  const maybeColumns = (contentJson as { detectedColumns?: unknown }).detectedColumns;
  if (!Array.isArray(maybeColumns)) {
    return [];
  }

  return maybeColumns.filter((value): value is string => typeof value === "string");
}

function dedupeBestByColumn(
  candidates: Array<{
    sourceColumn: string;
    sourceContextDocumentId: string;
    truthTier: "tier0" | "tier1" | "tier2" | "tier3";
  }>,
) {
  const byNormalized = new Map<
    string,
    {
      sourceColumn: string;
      sourceContextDocumentId: string;
      truthTier: "tier0" | "tier1" | "tier2" | "tier3";
    }
  >();

  for (const candidate of candidates) {
    const key = normalizeColumn(candidate.sourceColumn);
    const existing = byNormalized.get(key);

    if (!existing || truthTierWeight(candidate.truthTier) > truthTierWeight(existing.truthTier)) {
      byNormalized.set(key, candidate);
    }
  }

  return Array.from(byNormalized.values());
}

function scoreCandidate(
  targetColumn: string,
  candidate: {
    sourceColumn: string;
    sourceContextDocumentId: string;
    truthTier: "tier0" | "tier1" | "tier2" | "tier3";
  },
): ScoredCandidate {
  const normalizedTarget = normalizeColumn(targetColumn);
  const normalizedSource = normalizeColumn(candidate.sourceColumn);

  if (!normalizedTarget || !normalizedSource) {
    return {
      sourceColumn: candidate.sourceColumn,
      sourceContextDocumentId: candidate.sourceContextDocumentId,
      confidence: 0,
      matchMethod: "none",
    };
  }

  let baseScore = 0;
  let matchMethod: MatchMethod = "none";

  if (normalizedTarget === normalizedSource) {
    baseScore = 1;
    matchMethod = "exact";
  } else if (
    normalizedTarget.includes(normalizedSource) ||
    normalizedSource.includes(normalizedTarget)
  ) {
    baseScore = 0.82;
    matchMethod = "substring";
  } else {
    const overlap = tokenOverlap(normalizedTarget, normalizedSource);
    if (overlap >= 0.34) {
      baseScore = 0.55 + overlap * 0.35;
      matchMethod = "token_overlap";
    }
  }

  const confidence = clamp01(round2(baseScore * truthTierWeight(candidate.truthTier)));
  if (confidence < 0.35 || matchMethod === "none") {
    return {
      sourceColumn: candidate.sourceColumn,
      sourceContextDocumentId: candidate.sourceContextDocumentId,
      confidence: 0,
      matchMethod: "none",
    };
  }

  return {
    sourceColumn: candidate.sourceColumn,
    sourceContextDocumentId: candidate.sourceContextDocumentId,
    confidence,
    matchMethod,
  };
}

function isColumnHintSuggestion(candidate: ScoredCandidate): candidate is ColumnHintSuggestion {
  return candidate.matchMethod !== "none";
}

function normalizeColumn(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlapCount = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return overlapCount / Math.max(leftTokens.size, rightTokens.size);
}

function truthTierWeight(tier: "tier0" | "tier1" | "tier2" | "tier3"): number {
  switch (tier) {
    case "tier0":
      return 1;
    case "tier1":
      return 0.92;
    case "tier2":
      return 0.82;
    case "tier3":
      return 0.7;
    default:
      return 0.7;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
