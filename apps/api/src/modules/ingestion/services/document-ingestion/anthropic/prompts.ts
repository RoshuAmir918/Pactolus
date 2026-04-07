import { asInteger, asString } from "../shared/parsers";

export function buildTriangleExtractionPrompt(input: {
  fileName: string;
  sheet: Record<string, unknown>;
  sheetCSV: string;
  strictMode: boolean;
  existingTriangleSignatures: string[];
}): string {
  const sheetName = asString((input.sheet as { sheetName?: unknown }).sheetName);
  const sheetIndex = asInteger((input.sheet as { sheetIndex?: unknown }).sheetIndex);
  const dedupeInstruction =
    input.existingTriangleSignatures.length > 0
      ? `- Do not re-extract triangles matching these existing signatures: ${input.existingTriangleSignatures.join(", ")}`
      : "";
  const strictInstruction = input.strictMode
    ? "- Only return triangles with complete, non-empty matrices."
    : "- Return all triangles found, even if partially populated.";

  return [
    "You are extracting loss development triangles from a spreadsheet sheet.",
    "",
    `FILE: ${input.fileName}`,
    `SHEET NAME: ${sheetName ?? "unknown"}`,
    `SHEET INDEX: ${sheetIndex ?? -1}`,
    "",
    "SHEET DATA (full grid, CSV format):",
    input.sheetCSV,
    "",
    "INSTRUCTIONS:",
    "- Extract ALL loss triangles from this sheet. There may be multiple triangles stacked vertically, separated by blank rows or title rows.",
    "- Each triangle has: a title row, a header row (development periods: 12, 24, 36... or similar), and data rows (accident years as row labels).",
    "- Blank rows or text-only rows between numeric blocks indicate a new triangle section.",
    "- For each triangle extract: title, triangleType (paid/incurred/reported/unknown), lineOfBusiness, accident years, development period headers, and the full matrix of values.",
    "- Null or empty cells in the lower-right represent the future diagonal; include them as null.",
    `- sheetIndex for all returned triangles must be ${sheetIndex ?? -1}.`,
    "- Tool argument payload MUST include a top-level key named triangles.",
    "- triangles MUST always be an array (use [] when no triangles are found).",
    "- Do not rename the triangles key.",
    dedupeInstruction,
    strictInstruction,
    "",
    "Respond by calling the provided tool with valid arguments only.",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function buildWorkbookClassificationPrompt(input: {
  fileName: string;
  deterministicDocument: Record<string, unknown>;
  deterministicSheets: Array<Record<string, unknown>>;
}): string {
  return JSON.stringify({
    task: "Classify workbook and each sheet for ingestion routing.",
    fileName: input.fileName,
    deterministicContext: {
      document: input.deterministicDocument,
      sheets: input.deterministicSheets.map((sheet) => ({
        sheetName: asString((sheet as { sheetName?: unknown }).sheetName),
        sheetIndex: asInteger((sheet as { sheetIndex?: unknown }).sheetIndex),
        rowCountEstimate: asInteger((sheet as { rowCountEstimate?: unknown }).rowCountEstimate),
        headersJson: (sheet as { headersJson?: unknown }).headersJson ?? [],
        sampleRowsJson: (sheet as { sampleRowsJson?: unknown }).sampleRowsJson ?? [],
      })),
    },
    instructions: [
      "Use attached Anthropic file references as primary source.",
      "Use deterministicContext sheet slices to improve sheet-level labeling.",
      "Choose one documentType: claims, policies, loss_triangles, workbook_tool, other.",
      "Respond by calling the provided tool with valid arguments only.",
    ],
  });
}

export function buildContractPrompt(input: {
  fileName: string;
  mimeType: string;
  deterministicContext: unknown;
  supplementalText: string | null;
}): string {
  return JSON.stringify({
    task: "Extract treaty/contract terms and short narrative.",
    file: {
      fileName: input.fileName,
      mimeType: input.mimeType,
    },
    deterministicContext: input.deterministicContext,
    supplementalText: input.supplementalText,
    instructions: [
      "Respond by calling the provided tool with valid arguments only.",
      "Extract cedant/reinsurer, treaty type, lines, limits/retentions, attachment points, cession rates, period, notable clauses if present.",
      "If supplementalText is present, use it as extra context.",
    ],
  });
}
