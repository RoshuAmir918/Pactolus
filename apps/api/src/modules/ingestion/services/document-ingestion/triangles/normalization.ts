import { asInteger, asString } from "../shared/parsers";

export function hasNonEmptyTriangleMatrix(triangle: Record<string, unknown>): boolean {
  const normalized = coerceNormalizedTriangleShape(triangle);
  const rows = normalized.rows;
  const developmentHeaders = normalized.developmentHeaders;
  return Array.isArray(rows) && rows.length > 0 && Array.isArray(developmentHeaders) && developmentHeaders.length > 0;
}

export function buildTrianglePayloadWithMetadata(triangle: Record<string, unknown>): Record<string, unknown> {
  const normalized = coerceNormalizedTriangleShape(triangle);
  const metadata = {
    industry: asString((triangle as { industry?: unknown }).industry),
    lineOfBusiness: asString((triangle as { lineOfBusiness?: unknown }).lineOfBusiness),
    portfolioClassification: asString(
      (triangle as { portfolioClassification?: unknown }).portfolioClassification,
    ),
    segmentClassification: asString((triangle as { segmentClassification?: unknown }).segmentClassification),
    extra: (triangle as { metadata?: unknown }).metadata ?? null,
  };
  return {
    ...normalized,
    metadata,
  };
}

export function normalizeTrianglesFromClaude(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((triangle) => {
      if (!triangle || typeof triangle !== "object") {
        return null;
      }
      const sheetIndex = asInteger((triangle as { sheetIndex?: unknown }).sheetIndex);
      if (sheetIndex === null) {
        return null;
      }
      return triangle as Record<string, unknown>;
    })
    .filter((triangle): triangle is Record<string, unknown> => triangle !== null);
}

export function triangleSignature(triangle: Record<string, unknown>): string {
  const sheetIndex = asInteger((triangle as { sheetIndex?: unknown }).sheetIndex) ?? -1;
  const title = asString((triangle as { title?: unknown }).title) ?? "";
  const segmentLabel = asString((triangle as { segmentLabel?: unknown }).segmentLabel) ?? "";
  const triangleType = asString((triangle as { triangleType?: unknown }).triangleType) ?? "unknown";
  const rowStart = asInteger((triangle as { rowStart?: unknown }).rowStart) ?? -1;
  const rowEnd = asInteger((triangle as { rowEnd?: unknown }).rowEnd) ?? -1;
  const colStart = asInteger((triangle as { colStart?: unknown }).colStart) ?? -1;
  const colEnd = asInteger((triangle as { colEnd?: unknown }).colEnd) ?? -1;
  return [sheetIndex, title, segmentLabel, triangleType, rowStart, rowEnd, colStart, colEnd].join("|");
}

function coerceNormalizedTriangleShape(triangle: Record<string, unknown>): {
  rows: unknown[];
  developmentHeaders: unknown[];
  [key: string]: unknown;
} {
  const normalizedRaw = (triangle as { normalizedTriangleJson?: unknown }).normalizedTriangleJson;
  const normalizedArray = Array.isArray(normalizedRaw) ? normalizedRaw : null;
  const normalized =
    normalizedRaw && typeof normalizedRaw === "object" && !Array.isArray(normalizedRaw)
      ? ((normalizedRaw as Record<string, unknown>) ?? {})
      : {};
  const headerLabelsRaw = (triangle as { headerLabelsJson?: unknown }).headerLabelsJson;
  const headerLabels =
    headerLabelsRaw && typeof headerLabelsRaw === "object" && !Array.isArray(headerLabelsRaw)
      ? ((headerLabelsRaw as Record<string, unknown>) ?? {})
      : {};
  const headerLabelsArray = Array.isArray(headerLabelsRaw) ? headerLabelsRaw : null;

  const rowsCandidate =
    pickFirstArray(
      normalizedArray,
      normalized.rows,
      normalized.matrix,
      (normalized.data as Record<string, unknown> | undefined)?.rows,
      (normalized.values as unknown[] | undefined) ?? undefined,
      buildRowsFromYearKeyedObject(normalized),
    ) ?? [];

  const headersCandidate =
    pickFirstArray(
      normalized.developmentHeaders,
      normalized.developmentPeriods,
      (normalized.headerLabels as Record<string, unknown> | undefined)?.developmentHeaders,
      headerLabels.developmentHeaders,
      headerLabels.columnHeaders,
      headerLabelsArray,
    ) ?? [];

  return {
    ...normalized,
    rows: rowsCandidate,
    developmentHeaders: headersCandidate,
  };
}

function pickFirstArray(...values: Array<unknown>): unknown[] | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
}

function buildRowsFromYearKeyedObject(normalized: Record<string, unknown>): unknown[] | null {
  const entries = Object.entries(normalized).filter(([key, value]) => {
    // Match keys like "2016", "2017", etc. with array values.
    return /^\d{4}$/.test(key) && Array.isArray(value);
  });
  if (entries.length === 0) {
    return null;
  }
  return entries
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([accidentYear, values]) => ({
      accidentYear,
      values,
    }));
}
