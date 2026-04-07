import type { DiscoverAndExtractResult } from "../../discovery/discoverAndExtract";
import { callClaudeTool } from "../anthropic/client";
import { buildTriangleExtractionPrompt } from "../anthropic/prompts";
import { TRIANGLE_EXTRACTION_TOOL } from "../anthropic/tools";
import {
  loadSheetIdsByIndex,
  loadTriangleCandidateSheets,
} from "../persistence/sheetsRepo";
import { insertTrianglesFromExtracted } from "../persistence/trianglesRepo";
import { asInteger, asString } from "../shared/parsers";
import type { TargetDocument } from "../shared/types";
import {
  hasNonEmptyTriangleMatrix,
  normalizeTrianglesFromClaude,
  triangleSignature,
} from "../triangles/normalization";

export async function processTriangleBranch(input: {
  target: TargetDocument;
  deterministic: DiscoverAndExtractResult;
}) {
  const { target } = input;
  const sheetIds = await loadSheetIdsByIndex(target.documentId);
  const triangleLikeSheets = await loadTriangleCandidateSheets(target.documentId);
  const sheetsToExtract = triangleLikeSheets;

  const extractedTriangleRecords: Array<Record<string, unknown>> = [];
  for (const sheet of sheetsToExtract) {
    const extracted = await extractTrianglesForSheet({ target, sheet });
    extractedTriangleRecords.push(...extracted.triangles);
  }

  await insertTrianglesFromExtracted({
    target,
    sheetIds,
    extractedTriangleRecords,
  });

}

async function extractTrianglesForSheet(input: {
  target: TargetDocument;
  sheet: Record<string, unknown>;
}): Promise<{ triangles: Array<Record<string, unknown>> }> {
  const sheetIndex = asInteger((input.sheet as { sheetIndex?: unknown }).sheetIndex);
  const sheetName = asString((input.sheet as { sheetName?: unknown }).sheetName);
  if (sheetIndex === null) {
    return { triangles: [] };
  }

  const collected: Array<Record<string, unknown>> = [];
  const debugEnabled = process.env.INGESTION_DEBUG_TRIANGLES === "1";
  const csvWindows = buildSheetCsvWindows(input.sheet);
  const sheetCSV = csvWindows[0]?.sheetCSV ?? "";
  if (debugEnabled) {
    console.info("[ingestion.triangles.csv]", {
      documentId: input.target.documentId,
      sheetIndex,
      sheetName,
      csvLength: sheetCSV.length,
      csvPreview: sheetCSV.slice(0, 300),
      csvWindows: csvWindows.length,
    });
  }

  for (const [windowIndex, window] of csvWindows.entries()) {
    const { primary, retry } = resolveExtractionTokenBudgets(window.sheetCSV.length);
    const prompt = buildTriangleExtractionPrompt({
      fileName: input.target.filename,
      sheet: window.sheet,
      sheetCSV: window.sheetCSV,
      strictMode: true,
      existingTriangleSignatures: collected.map((triangle) => triangleSignature(triangle)).slice(-30),
    });
    const extraction = await callTriangleExtractionWithRetry({
      target: input.target,
      sheetIndex,
      sheetName,
      prompt,
      primaryMaxTokens: primary,
      retryMaxTokens: retry,
      debugEnabled,
    });

    if (debugEnabled) {
      const rawParsedText = buildSafePreview(extraction.rawTrianglePayload);
      const rawKind = Array.isArray(extraction.rawTrianglePayload)
        ? "array"
        : extraction.rawTrianglePayload === null
          ? "null"
          : typeof extraction.rawTrianglePayload;
      const rawKeys =
        extraction.rawTrianglePayload &&
        typeof extraction.rawTrianglePayload === "object" &&
        !Array.isArray(extraction.rawTrianglePayload)
          ? Object.keys(extraction.rawTrianglePayload as Record<string, unknown>).slice(0, 20)
          : [];
      console.info("[ingestion.triangles.raw]", {
        documentId: input.target.documentId,
        sheetIndex,
        sheetName,
        windowIndex: windowIndex + 1,
        windowCount: csvWindows.length,
        rowStart: window.rowStart,
        rowEnd: window.rowEnd,
        rawKind,
        rawKeys,
        rawParsed: rawParsedText,
        toolInputKeys: Object.keys(extraction.parsed).slice(0, 20),
        retriedForMissingToolPayload: extraction.retriedForMissingToolPayload,
        primaryMaxTokens: primary,
        retryMaxTokens: retry,
      });
    }

    const normalized = normalizeTrianglesFromClaude(extraction.rawTrianglePayload);
    const extracted = normalized.filter((triangle) => {
      const extractedSheetIndex = asInteger((triangle as { sheetIndex?: unknown }).sheetIndex);
      return extractedSheetIndex === sheetIndex && hasNonEmptyTriangleMatrix(triangle);
    });

    if (debugEnabled) {
      const nonMatchingSheet = normalized.filter((triangle) => {
        const extractedSheetIndex = asInteger((triangle as { sheetIndex?: unknown }).sheetIndex);
        return extractedSheetIndex !== sheetIndex;
      });
      const missingMatrix = normalized.filter((triangle) => !hasNonEmptyTriangleMatrix(triangle));
      console.info("[ingestion.triangles]", {
        documentId: input.target.documentId,
        sheetIndex,
        sheetName,
        strictMode: true,
        windowIndex: windowIndex + 1,
        windowCount: csvWindows.length,
        rowStart: window.rowStart,
        rowEnd: window.rowEnd,
        rawTriangles: Array.isArray(extraction.rawTrianglePayload) ? extraction.rawTrianglePayload.length : 0,
        normalizedTriangles: normalized.length,
        filteredOutNonMatchingSheet: nonMatchingSheet.length,
        filteredOutMissingMatrix: missingMatrix.length,
        acceptedTriangles: extracted.length,
        observedSheetIndexes: [...new Set(normalized.map((triangle) => asInteger(triangle.sheetIndex)))],
      });
    }

    for (const triangle of extracted) {
      if (!isDuplicateTriangle(collected, triangle)) {
        collected.push(triangle);
      }
    }
  }

  if (debugEnabled) {
    console.info("[ingestion.triangles]", {
      documentId: input.target.documentId,
      sheetIndex,
      strictMode: true,
      totalCollected: collected.length,
    });
  }

  return { triangles: collected };
}

async function callTriangleExtractionWithRetry(input: {
  target: TargetDocument;
  sheetIndex: number;
  sheetName: string | null;
  prompt: string;
  primaryMaxTokens: number;
  retryMaxTokens: number;
  debugEnabled: boolean;
}): Promise<{
  parsed: {
    triangles?: unknown;
    narrative?: unknown;
    [key: string]: unknown;
  };
  rawTrianglePayload: unknown;
  retriedForMissingToolPayload: boolean;
}> {
  let parsed: {
    triangles?: unknown;
    narrative?: unknown;
    [key: string]: unknown;
  } = {};
  let rawTrianglePayload: unknown = undefined;
  let extractionError: unknown = null;
  let retriedForMissingToolPayload = false;

  try {
    parsed = await callClaudeTool<{
      triangles?: unknown;
      narrative?: unknown;
      [key: string]: unknown;
    }>({
      prompt: input.prompt,
      tool: TRIANGLE_EXTRACTION_TOOL,
      maxTokens: input.primaryMaxTokens,
    });
    rawTrianglePayload = coerceTriangleArrayPayload(parsed);
  } catch (error) {
    extractionError = error;
  }

  if (!Array.isArray(rawTrianglePayload)) {
    retriedForMissingToolPayload = true;
    if (input.debugEnabled) {
      console.warn("[ingestion.triangles.retry]", {
        documentId: input.target.documentId,
        sheetIndex: input.sheetIndex,
        sheetName: input.sheetName,
        reason: "missing_or_invalid_tool_payload",
        primaryMaxTokens: input.primaryMaxTokens,
        retryMaxTokens: input.retryMaxTokens,
        firstAttemptError: extractionError instanceof Error ? extractionError.message : null,
      });
    }
    parsed = await callClaudeTool<{
      triangles?: unknown;
      narrative?: unknown;
      [key: string]: unknown;
    }>({
      prompt: `${input.prompt}

IMPORTANT:
- You MUST call the extract_loss_triangles tool exactly once.
- The tool input MUST include a top-level "triangles" key.
- "triangles" MUST be an array, even when no triangles are found (use []).`,
      tool: TRIANGLE_EXTRACTION_TOOL,
      maxTokens: input.retryMaxTokens,
    });
    rawTrianglePayload = coerceTriangleArrayPayload(parsed);
  }

  return {
    parsed,
    rawTrianglePayload,
    retriedForMissingToolPayload,
  };
}

function resolveExtractionTokenBudgets(csvLength: number): {
  primary: number;
  retry: number;
} {
  const minimum = Math.max(2000, parsePositiveInt(process.env.INGESTION_TRIANGLE_MIN_TOKENS, 4000));
  const ceiling = Math.max(
    minimum,
    parsePositiveInt(process.env.INGESTION_TRIANGLE_MAX_TOKENS, 12000),
  );
  const estimated = Math.ceil(csvLength * 2.4);
  const primary = Math.min(Math.max(minimum, estimated), ceiling);
  const retryBoost = Math.max(1200, Math.round(primary * 0.25));
  const retry = Math.min(primary + retryBoost, ceiling);
  return { primary, retry };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildSheetCsvWindows(
  sheet: Record<string, unknown>,
): Array<{ sheet: Record<string, unknown>; sheetCSV: string; rowStart: number; rowEnd: number }> {
  const headers = Array.isArray((sheet as { headersJson?: unknown }).headersJson)
    ? ((sheet as { headersJson?: unknown[] }).headersJson as unknown[])
    : [];
  const rows = Array.isArray((sheet as { sampleRowsJson?: unknown }).sampleRowsJson)
    ? ((sheet as { sampleRowsJson?: unknown[] }).sampleRowsJson as unknown[])
    : [];
  if (rows.length === 0) {
    return [
      {
        sheet,
        sheetCSV: serializeSheetToCSV(sheet),
        rowStart: 1,
        rowEnd: 0,
      },
    ];
  }

  const triggerRows = parsePositiveInt(process.env.INGESTION_TRIANGLE_PAGINATION_TRIGGER_ROWS, 180);
  if (rows.length <= triggerRows) {
    return [
      {
        sheet,
        sheetCSV: serializeSheetToCSV(sheet),
        rowStart: 1,
        rowEnd: rows.length,
      },
    ];
  }

  const windowSize = parsePositiveInt(process.env.INGESTION_TRIANGLE_WINDOW_ROWS, 180);
  const overlap = Math.min(
    windowSize - 1,
    parsePositiveInt(process.env.INGESTION_TRIANGLE_WINDOW_OVERLAP_ROWS, 30),
  );
  const windows: Array<{ sheet: Record<string, unknown>; sheetCSV: string; rowStart: number; rowEnd: number }> = [];
  let start = 0;
  while (start < rows.length) {
    const end = Math.min(rows.length, start + windowSize);
    const windowRows = rows.slice(start, end);
    const windowSheet = {
      ...sheet,
      headersJson: headers,
      sampleRowsJson: windowRows,
    };
    windows.push({
      sheet: windowSheet,
      sheetCSV: serializeSheetToCSV(windowSheet),
      rowStart: start + 1,
      rowEnd: end,
    });
    if (end >= rows.length) {
      break;
    }
    start = Math.max(start + 1, end - overlap);
  }
  return windows;
}

function isDuplicateTriangle(
  existingTriangles: Array<Record<string, unknown>>,
  candidate: Record<string, unknown>,
): boolean {
  const geometricSignature = triangleSignature(candidate);
  const contentSignature = triangleContentSignature(candidate);
  return existingTriangles.some((existing) => {
    return (
      triangleSignature(existing) === geometricSignature ||
      triangleContentSignature(existing) === contentSignature
    );
  });
}

function triangleContentSignature(triangle: Record<string, unknown>): string {
  return stableStringify({
    sheetIndex: asInteger((triangle as { sheetIndex?: unknown }).sheetIndex) ?? -1,
    title: asString((triangle as { title?: unknown }).title) ?? "",
    segmentLabel: asString((triangle as { segmentLabel?: unknown }).segmentLabel) ?? "",
    triangleType: asString((triangle as { triangleType?: unknown }).triangleType) ?? "unknown",
    headerLabelsJson: (triangle as { headerLabelsJson?: unknown }).headerLabelsJson ?? null,
    normalizedTriangleJson: (triangle as { normalizedTriangleJson?: unknown }).normalizedTriangleJson ?? null,
  });
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortUnknown(value));
}

function sortUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortUnknown);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const sorted: Record<string, unknown> = {};
  for (const [key, innerValue] of entries) {
    sorted[key] = sortUnknown(innerValue);
  }
  return sorted;
}

function serializeSheetToCSV(sheet: Record<string, unknown>): string {
  const headers = Array.isArray((sheet as { headersJson?: unknown }).headersJson)
    ? ((sheet as { headersJson?: unknown[] }).headersJson as unknown[]).map((header) => String(header ?? ""))
    : [];
  const rows = Array.isArray((sheet as { sampleRowsJson?: unknown }).sampleRowsJson)
    ? ((sheet as { sampleRowsJson?: unknown[] }).sampleRowsJson as unknown[])
    : [];

  const lines: string[] = [];
  if (headers.length > 0) {
    lines.push(headers.map(escapeCsvCell).join(","));
  }

  for (const row of rows.slice(0, 500)) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const values = headers.map((header) => escapeCsvCell((row as Record<string, unknown>)[header] ?? ""));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  return text.includes(",") || text.includes("\"") || text.includes("\n")
    ? `"${text.replaceAll("\"", "\"\"")}"`
    : text;
}

function buildSafePreview(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    const serialized = JSON.stringify(
      value,
      (_, current) => {
        if (typeof current === "bigint") {
          return current.toString();
        }
        if (current && typeof current === "object") {
          if (seen.has(current as object)) {
            return "[circular]";
          }
          seen.add(current as object);
        }
        return current;
      },
      0,
    );
    if (typeof serialized !== "string") {
      return String(serialized);
    }
    return serialized.slice(0, 1200);
  } catch {
    return "[unserializable triangles payload]";
  }
}

function coerceTriangleArrayPayload(parsed: { triangles?: unknown; [key: string]: unknown }): unknown {
  if (Array.isArray(parsed.triangles)) {
    return parsed.triangles;
  }

  const commonAliases = ["lossTriangles", "triangleBlocks", "triangleRows", "items", "results"] as const;
  for (const alias of commonAliases) {
    if (Array.isArray(parsed[alias])) {
      return parsed[alias];
    }
  }

  for (const [, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) {
      continue;
    }
    // Prefer arrays that look like triangle objects with sheetIndex + matrix-ish payload.
    const looksLikeTriangles = value.some((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const record = item as Record<string, unknown>;
      return (
        typeof record.sheetIndex === "number" ||
        typeof record.sheet_index === "number" ||
        "normalizedTriangleJson" in record ||
        "matrix" in record
      );
    });
    if (looksLikeTriangles) {
      return value;
    }
    // Fallback to first object-array if no better hint appears.
    const looksLikeObjectArray = value.length > 0 && value.every((item) => item && typeof item === "object");
    if (looksLikeObjectArray) {
      return value;
    }
  }

  return parsed.triangles;
}
