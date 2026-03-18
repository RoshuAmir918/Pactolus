import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { documentSheets } from "@db/schema";
import type { ClaudeWorkbookRoutingResult, TargetDocument } from "../shared/types";
import { asEnum, asInteger, asString, toConfidence } from "../shared/parsers";
import type { DiscoverAndExtractResult } from "../../discovery/discoverAndExtract";

const { db } = dbClient;

export async function upsertSheetsFromDeterministic(input: {
  target: TargetDocument;
  deterministic: DiscoverAndExtractResult;
}) {
  const { target, deterministic } = input;
  const sheets = deterministic.sheets;
  const toWrite = sheets.length > 0 ? sheets : [{ sheetName: "main", sheetIndex: 0, sheetType: "unknown" }];

  for (const [fallbackIndex, sheet] of toWrite.entries()) {
    const sheetName = asString((sheet as { sheetName?: unknown }).sheetName) ?? `sheet_${fallbackIndex}`;
    const sheetIndex = asInteger((sheet as { sheetIndex?: unknown }).sheetIndex) ?? fallbackIndex;
    const sheetType =
      asEnum((sheet as { sheetType?: unknown }).sheetType, [
        "claims_like",
        "policies_like",
        "triangle_like",
        "tool_sheet",
        "other",
        "unknown",
      ] as const) ?? "unknown";
    const aiClassification =
      asEnum((sheet as { aiClassification?: unknown }).aiClassification, [
        "claims_like",
        "policies_like",
        "triangle_like",
        "tool_sheet",
        "other",
        "unknown",
      ] as const) ?? "unknown";
    await db
      .insert(documentSheets)
      .values({
        documentId: target.documentId,
        orgId: target.orgId,
        snapshotId: target.snapshotId,
        sheetName,
        sheetIndex,
        sheetType,
        usedRangeJson: (sheet as { usedRangeJson?: unknown }).usedRangeJson ?? null,
        headersJson: (sheet as { headersJson?: unknown }).headersJson ?? [],
        sampleRowsJson: (sheet as { sampleRowsJson?: unknown }).sampleRowsJson ?? [],
        rowCountEstimate: asInteger((sheet as { rowCountEstimate?: unknown }).rowCountEstimate),
        detectedTablesJson: (sheet as { detectedTablesJson?: unknown }).detectedTablesJson ?? [],
        sheetAboutJson: (sheet as { sheetAboutJson?: unknown }).sheetAboutJson ?? null,
        aiClassification,
        aiConfidence: toConfidence((sheet as { aiConfidence?: unknown }).aiConfidence),
        searchText: asString((sheet as { searchText?: unknown }).searchText),
        profileStatus: "completed",
        errorText: null,
      })
      .onConflictDoUpdate({
        target: [documentSheets.documentId, documentSheets.sheetIndex],
        set: {
          sheetName,
          sheetType,
          usedRangeJson: (sheet as { usedRangeJson?: unknown }).usedRangeJson ?? null,
          headersJson: (sheet as { headersJson?: unknown }).headersJson ?? [],
          sampleRowsJson: (sheet as { sampleRowsJson?: unknown }).sampleRowsJson ?? [],
          rowCountEstimate: asInteger((sheet as { rowCountEstimate?: unknown }).rowCountEstimate),
          detectedTablesJson: (sheet as { detectedTablesJson?: unknown }).detectedTablesJson ?? [],
          sheetAboutJson: (sheet as { sheetAboutJson?: unknown }).sheetAboutJson ?? null,
          aiClassification,
          aiConfidence: toConfidence((sheet as { aiConfidence?: unknown }).aiConfidence),
          searchText: asString((sheet as { searchText?: unknown }).searchText),
          profileStatus: "completed",
          errorText: null,
          updatedAt: new Date(),
        },
      });
  }
}

export async function applyClaudeSheetClassifications(
  documentId: string,
  sheetClassifications: ClaudeWorkbookRoutingResult["sheetClassifications"],
) {
  for (const classification of sheetClassifications) {
    await db
      .update(documentSheets)
      .set({
        sheetType: classification.sheetType,
        aiClassification: classification.aiClassification,
        aiConfidence: classification.aiConfidence,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentSheets.documentId, documentId),
          eq(documentSheets.sheetIndex, classification.sheetIndex),
        ),
      );
  }
}

export async function loadSheetIdsByIndex(documentId: string): Promise<Map<number, string>> {
  const rows = await db
    .select({ id: documentSheets.id, sheetIndex: documentSheets.sheetIndex })
    .from(documentSheets)
    .where(eq(documentSheets.documentId, documentId));
  return new Map(rows.map((row) => [row.sheetIndex, row.id]));
}

export async function loadTriangleCandidateSheets(documentId: string): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select({
      sheetIndex: documentSheets.sheetIndex,
      sheetName: documentSheets.sheetName,
      sheetType: documentSheets.sheetType,
      aiClassification: documentSheets.aiClassification,
      usedRangeJson: documentSheets.usedRangeJson,
      headersJson: documentSheets.headersJson,
      sampleRowsJson: documentSheets.sampleRowsJson,
      detectedTablesJson: documentSheets.detectedTablesJson,
      sheetAboutJson: documentSheets.sheetAboutJson,
      rowCountEstimate: documentSheets.rowCountEstimate,
    })
    .from(documentSheets)
    .where(eq(documentSheets.documentId, documentId));

  return rows
    .filter((row) => row.sheetType === "triangle_like" || row.aiClassification === "triangle_like")
    .map((row) => ({ ...row }));
}
