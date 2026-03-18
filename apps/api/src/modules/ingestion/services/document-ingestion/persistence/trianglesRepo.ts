import dbClient from "@api/db/client";
import { documentTriangles } from "@db/schema";
import { asEnum, asInteger, asString, toConfidence } from "../shared/parsers";
import { buildTrianglePayloadWithMetadata } from "../triangles/normalization";
import type { TargetDocument } from "../shared/types";

const { db } = dbClient;

export async function insertTrianglesFromExtracted(input: {
  target: TargetDocument;
  sheetIds: Map<number, string>;
  extractedTriangleRecords: Array<Record<string, unknown>>;
}) {
  const triangles = input.extractedTriangleRecords
    .map((triangle) => {
      const sheetIndex = asInteger((triangle as { sheetIndex?: unknown }).sheetIndex);
      if (sheetIndex === null) {
        return null;
      }
      const sheetId = input.sheetIds.get(sheetIndex);
      if (!sheetId) {
        return null;
      }
      return {
        documentId: input.target.documentId,
        sheetId,
        orgId: input.target.orgId,
        snapshotId: input.target.snapshotId,
        title: asString((triangle as { title?: unknown }).title),
        segmentLabel: asString((triangle as { segmentLabel?: unknown }).segmentLabel),
        triangleType:
          asEnum((triangle as { triangleType?: unknown }).triangleType, [
            "paid",
            "incurred",
            "reported",
            "ultimate",
            "unknown",
          ] as const) ?? "unknown",
        rowStart: asInteger((triangle as { rowStart?: unknown }).rowStart),
        rowEnd: asInteger((triangle as { rowEnd?: unknown }).rowEnd),
        colStart: asInteger((triangle as { colStart?: unknown }).colStart),
        colEnd: asInteger((triangle as { colEnd?: unknown }).colEnd),
        headerLabelsJson: (triangle as { headerLabelsJson?: unknown }).headerLabelsJson ?? null,
        normalizedTriangleJson: buildTrianglePayloadWithMetadata(triangle),
        confidence: toConfidence((triangle as { confidence?: unknown }).confidence),
        extractionMethod: "ai" as const,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (triangles.length > 0) {
    await db.insert(documentTriangles).values(triangles);
  }

  return triangles;
}
