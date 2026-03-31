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

export type GetColumnMappingHintsResult = {
  hints: Array<{
    targetColumn: string;
    suggestions: Array<{
      sourceColumn: string;
      confidence: number;
      sourceContextDocumentId: string;
      matchMethod: "semantic_ai";
    }>;
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "ANTHROPIC_API_KEY is not configured",
    });
  }

  const contextCandidates = await loadContextCandidates(input.orgId, input.snapshotId);
  const prompt = buildPrompt(input.targetColumns, contextCandidates, input.maxSuggestionsPerColumn);
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5";
  const aiRaw = await callAnthropicJson({
    apiKey,
    model,
    prompt,
  });

  return normalizeAiResult(aiRaw, contextCandidates, input.maxSuggestionsPerColumn);
}

async function loadContextCandidates(orgId: string, snapshotId: string) {
  const documents = await db
    .select({
      id: contextDocuments.id,
      contentJson: contextDocuments.contentJson,
    })
    .from(contextDocuments)
    .where(
      and(
        eq(contextDocuments.orgId, orgId),
        eq(contextDocuments.snapshotId, snapshotId),
        eq(contextDocuments.status, "active"),
      ),
    )
    .orderBy(desc(contextDocuments.createdAt))
    .limit(200);

  const byNormalized = new Map<string, { sourceColumn: string; sourceContextDocumentId: string }>();
  for (const document of documents) {
    const columns = extractDetectedColumns(document.contentJson);
    for (const column of columns) {
      const normalized = normalize(column);
      if (!normalized || byNormalized.has(normalized)) {
        continue;
      }
      byNormalized.set(normalized, {
        sourceColumn: column,
        sourceContextDocumentId: document.id,
      });
    }
  }
  return Array.from(byNormalized.entries()).map(([normalized, value]) => ({
    normalized,
    sourceColumn: value.sourceColumn,
    sourceContextDocumentId: value.sourceContextDocumentId,
  }));
}

function buildPrompt(
  targetColumns: string[],
  contextCandidates: Array<{
    normalized: string;
    sourceColumn: string;
    sourceContextDocumentId: string;
  }>,
  maxSuggestionsPerColumn: number,
): string {
  return JSON.stringify({
    task: "Map target columns to context source columns.",
    targetColumns,
    contextCandidateColumns: contextCandidates.map((candidate) => candidate.sourceColumn),
    maxSuggestionsPerColumn,
    instructions: [
      "Use only source columns provided in contextCandidateColumns.",
      "Return strict JSON only.",
      "confidence must be between 0 and 1.",
      "If uncertain, return low confidence.",
    ],
    outputSchema: {
      hints: [
        {
          targetColumn: "string",
          suggestions: [
            {
              sourceColumn: "string",
              confidence: "number 0..1",
            },
          ],
        },
      ],
    },
  });
}

async function callAnthropicJson(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 900,
        temperature: 0.1,
        messages: [{ role: "user", content: input.prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((item) => item.type === "text")?.text;
    if (!text) {
      throw new Error("Anthropic returned no text content");
    }
    return parseJsonObject(text);
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Unable to parse JSON response from AI");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function normalizeAiResult(
  raw: unknown,
  candidates: Array<{
    normalized: string;
    sourceColumn: string;
    sourceContextDocumentId: string;
  }>,
  maxSuggestionsPerColumn: number,
): GetColumnMappingHintsResult {
  const byNormalized = new Map(candidates.map((candidate) => [candidate.normalized, candidate]));
  const hintsRaw = (raw as { hints?: unknown })?.hints;
  if (!Array.isArray(hintsRaw)) {
    return { hints: [] };
  }

  const hints = hintsRaw
    .map((hint) => {
      const targetColumn = String((hint as { targetColumn?: unknown }).targetColumn ?? "").trim();
      if (!targetColumn) {
        return null;
      }
      const suggestionsRaw = (hint as { suggestions?: unknown }).suggestions;
      if (!Array.isArray(suggestionsRaw)) {
        return { targetColumn, suggestions: [] };
      }

      const suggestions = suggestionsRaw
        .map((item) => {
          const sourceColumn = String((item as { sourceColumn?: unknown }).sourceColumn ?? "").trim();
          const confidence = Number((item as { confidence?: unknown }).confidence ?? 0);
          if (!sourceColumn || Number.isNaN(confidence)) {
            return null;
          }

          const matched = byNormalized.get(normalize(sourceColumn));
          if (!matched) {
            return null;
          }

          return {
            sourceColumn: matched.sourceColumn,
            confidence: clamp01(round2(confidence)),
            sourceContextDocumentId: matched.sourceContextDocumentId,
            matchMethod: "semantic_ai" as const,
          };
        })
        .filter(
          (
            item,
          ): item is {
            sourceColumn: string;
            confidence: number;
            sourceContextDocumentId: string;
            matchMethod: "semantic_ai";
          } => Boolean(item),
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxSuggestionsPerColumn);

      return { targetColumn, suggestions };
    })
    .filter(
      (
        hint,
      ): hint is {
        targetColumn: string;
        suggestions: Array<{
          sourceColumn: string;
          confidence: number;
          sourceContextDocumentId: string;
          matchMethod: "semantic_ai";
        }>;
      } => Boolean(hint),
    );

  return { hints };
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

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
