import { and, desc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { contextDocuments } from "@db/schema";

const { db } = dbClient;

type GetLiveHintsFromAiInput = {
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

type AiHintSuggestion = {
  sourceColumn: string;
  confidence: number;
  sourceContextDocumentId: string | null;
  matchMethod: "semantic_ai";
};

export type GetLiveHintsFromAiResult = {
  hints: Array<{
    targetColumn: string;
    suggestions: AiHintSuggestion[];
  }>;
};

export async function getLiveHintsFromAi(
  input: GetLiveHintsFromAiInput,
): Promise<GetLiveHintsFromAiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const contextCandidates = await loadContextCandidates(input.orgId, input.snapshotId);
  const prompt = buildPrompt(input, contextCandidates);
  const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest";

  const responseJson = await callAnthropicJson({
    apiKey,
    model,
    prompt,
  });

  return normalizeAiResult(responseJson, input.maxSuggestionsPerColumn, contextCandidates);
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
    .limit(50);

  const byColumn = new Map<string, string>();
  for (const document of documents) {
    const columns = extractDetectedColumns(document.contentJson);
    for (const column of columns) {
      const key = normalize(column);
      if (!key || byColumn.has(key)) {
        continue;
      }
      byColumn.set(key, document.id);
    }
  }

  return Array.from(byColumn.entries()).map(([normalized, docId]) => ({
    normalized,
    sourceColumn: denormalize(normalized),
    sourceContextDocumentId: docId,
  }));
}

function buildPrompt(
  input: GetLiveHintsFromAiInput,
  contextCandidates: Array<{
    normalized: string;
    sourceColumn: string;
    sourceContextDocumentId: string;
  }>,
): string {
  const candidateColumns = contextCandidates.map((candidate) => candidate.sourceColumn);
  const payload = {
    task: "Map target columns to likely source columns from sheet and context candidates.",
    targetColumns: input.targetColumns,
    sheetSlice: {
      workbookName: input.sheetSlice.workbookName ?? null,
      sheetName: input.sheetSlice.sheetName,
      selectedAddress: input.sheetSlice.selectedAddress,
      headers: input.sheetSlice.headers,
      sampleRows: input.sheetSlice.sampleRows ?? [],
    },
    contextCandidateColumns: candidateColumns,
    rules: [
      "Prefer source columns that semantically match target columns.",
      "Confidence must be between 0 and 1.",
      "If uncertain, return lower confidence.",
      "Return only strict JSON. No markdown.",
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
  };

  return JSON.stringify(payload);
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
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: input.prompt,
          },
        ],
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
  maxSuggestionsPerColumn: number,
  contextCandidates: Array<{
    normalized: string;
    sourceColumn: string;
    sourceContextDocumentId: string;
  }>,
): GetLiveHintsFromAiResult {
  const candidatesByNormalized = new Map(
    contextCandidates.map((candidate) => [candidate.normalized, candidate]),
  );

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
        return {
          targetColumn,
          suggestions: [],
        };
      }

      const suggestions = suggestionsRaw
        .map((suggestion) => {
          const sourceColumn = String((suggestion as { sourceColumn?: unknown }).sourceColumn ?? "")
            .trim();
          const confidence = Number((suggestion as { confidence?: unknown }).confidence ?? 0);
          if (!sourceColumn || Number.isNaN(confidence)) {
            return null;
          }

          const normalized = normalize(sourceColumn);
          const matchedContext = candidatesByNormalized.get(normalized);
          return {
            sourceColumn,
            confidence: clamp01(round2(confidence)),
            sourceContextDocumentId: matchedContext?.sourceContextDocumentId ?? null,
            matchMethod: "semantic_ai" as const,
          };
        })
        .filter((item): item is AiHintSuggestion => Boolean(item))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxSuggestionsPerColumn);

      return {
        targetColumn,
        suggestions,
      };
    })
    .filter(
      (
        item,
      ): item is {
        targetColumn: string;
        suggestions: AiHintSuggestion[];
      } => Boolean(item),
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

function denormalize(value: string): string {
  return value;
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
