/*
Legacy deterministic matcher (parked for MVP AI-only mode).
Moved from getColumnMappingHints.ts so we can re-enable later for
performance/fallback experiments.

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
  // ... deterministic implementation parked for now ...
  return { hints: [] };
}
*/
