import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { documentSheets, documents } from "@db/schema";

const { db } = dbClient;

const ANTHROPIC_FILES_BETA_HEADER = "files-api-2025-04-14";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export type WorkbookSheetInput = {
  sheetName: string;
  headers: string[];
  sampleRows: string[][];
  regions?: Array<{ address: string; type: string; fontColor: string }>;
  rowCount: number;
  columnCount: number;
};

export type DetectedSheetRegions = {
  sheetName: string;
  inputRegions: Array<{ address: string; reason: string; confidencePercent: number }>;
  outputRegions: Array<{ address: string; reason: string; confidencePercent: number }>;
};

export type DetectWorkbookRegionsResult = {
  sheets: DetectedSheetRegions[];
  promptMessage: string | null;
};

export async function detectWorkbookRegions(input: {
  orgId: string;
  snapshotId: string;
  sheets: WorkbookSheetInput[];
}): Promise<DetectWorkbookRegionsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  // Load ingested document metadata so Claude understands the source data
  const docSheets = await db
    .select({
      id: documentSheets.id,
      filename: documents.filename,
      sheetName: documentSheets.sheetName,
      sheetType: documentSheets.sheetType,
      rowCountEstimate: documentSheets.rowCountEstimate,
      headersJson: documentSheets.headersJson,
      sheetAboutJson: documentSheets.sheetAboutJson,
    })
    .from(documentSheets)
    .innerJoin(documents, eq(documents.id, documentSheets.documentId))
    .where(
      and(
        eq(documentSheets.snapshotId, input.snapshotId),
        eq(documentSheets.orgId, input.orgId),
      ),
    )
    .orderBy(documents.filename, documentSheets.sheetIndex);

  const systemPrompt = buildSystemPrompt(docSheets, input.sheets);

  const fetchSourceTool = {
    name: "fetch_source",
    description:
      "Retrieve detailed data from a specific ingested source document sheet to help understand what data is available to fill input regions.",
    input_schema: {
      type: "object",
      properties: {
        source_id: {
          type: "string",
          description: "The UUID of the document_sheet shown in the context above",
        },
        reason: {
          type: "string",
          description: "Brief explanation of why you need this data",
        },
      },
      required: ["source_id", "reason"],
    },
  };

  const reportRegionsTool = {
    name: "report_regions",
    description:
      "Report the identified input and output regions across the workbook sheets. Call this once you have analysed all sheets.",
    input_schema: {
      type: "object",
      properties: {
        sheets: {
          type: "array",
          description: "One entry per sheet that has input or output regions",
          items: {
            type: "object",
            properties: {
              sheet_name: { type: "string" },
              input_regions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    address: { type: "string", description: "Excel range address, e.g. B13:N22" },
                    reason: { type: "string", description: "Why this is an input region" },
                    confidence_percent: { type: "number" },
                  },
                  required: ["address", "reason", "confidence_percent"],
                },
              },
              output_regions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    reason: { type: "string" },
                    confidence_percent: { type: "number" },
                  },
                  required: ["address", "reason", "confidence_percent"],
                },
              },
            },
            required: ["sheet_name", "input_regions", "output_regions"],
          },
        },
        prompt_message: {
          type: "string",
          nullable: true,
          description:
            "A short, friendly message to show the user in chat when input regions are found. " +
            "Mention which sheets have inputs and what kind of data goes in them. " +
            "End with asking what they'd like to fill in. Null if no inputs found.",
        },
      },
      required: ["sheets", "prompt_message"],
    },
  };

  type ContentBlock = { type: string; id?: string; name?: string; input?: unknown; text?: string };

  let currentMessages: unknown[] = [
    {
      role: "user",
      content:
        "Analyse the workbook sheets I have described and identify all input and output regions. Call report_regions with your findings.",
    },
  ];

  const model = process.env.CLAUDE_MODEL?.trim()?.replace(/-latest$/, "") ?? DEFAULT_MODEL;

  for (let turn = 0; turn < 5; turn++) {
    const response = await callAnthropic({ apiKey, model, systemPrompt, messages: currentMessages, tools: [fetchSourceTool, reportRegionsTool] });
    const content = response.content as ContentBlock[];

    const toolUseBlocks = content.filter((b) => b.type === "tool_use" && b.id && b.input);

    if (toolUseBlocks.length === 0) {
      return { sheets: [], promptMessage: null };
    }

    currentMessages = [...currentMessages, { role: "assistant" as const, content }];

    // Check if any block is report_regions — if so, use it and return
    const reportBlock = toolUseBlocks.find((b) => b.name === "report_regions");
    if (reportBlock) {
      const toolInput = reportBlock.input as {
        sheets: Array<{
          sheet_name: string;
          input_regions: Array<{ address: string; reason: string; confidence_percent: number }>;
          output_regions: Array<{ address: string; reason: string; confidence_percent: number }>;
        }>;
        prompt_message: string | null;
      };

      const sheets: DetectedSheetRegions[] = toolInput.sheets.map((s) => ({
        sheetName: s.sheet_name,
        inputRegions: s.input_regions.map((r) => ({
          address: r.address,
          reason: r.reason,
          confidencePercent: r.confidence_percent,
        })),
        outputRegions: s.output_regions.map((r) => ({
          address: r.address,
          reason: r.reason,
          confidencePercent: r.confidence_percent,
        })),
      }));

      return { sheets, promptMessage: toolInput.prompt_message ?? null };
    }

    // All other blocks must be fetch_source — resolve all in parallel then return one tool_result message
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (b) => {
        if (b.name === "fetch_source") {
          const toolInput = b.input as { source_id: string; reason: string };
          const fetchedContent = await resolveDocumentSheet(toolInput.source_id, input.orgId);
          return { type: "tool_result", tool_use_id: b.id!, content: fetchedContent };
        }
        return { type: "tool_result", tool_use_id: b.id!, content: "Unknown tool." };
      }),
    );

    currentMessages = [
      ...currentMessages,
      { role: "user" as const, content: toolResults },
    ];
  }

  return { sheets: [], promptMessage: null };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function resolveDocumentSheet(sourceId: string, orgId: string): Promise<string> {
  const [sheet] = await db
    .select({
      sheetName: documentSheets.sheetName,
      headersJson: documentSheets.headersJson,
      sampleRowsJson: documentSheets.sampleRowsJson,
      detectedTablesJson: documentSheets.detectedTablesJson,
      rowCountEstimate: documentSheets.rowCountEstimate,
    })
    .from(documentSheets)
    .where(and(eq(documentSheets.id, sourceId), eq(documentSheets.orgId, orgId)))
    .limit(1);

  if (!sheet) return "Source not found.";
  return JSON.stringify(
    {
      sheetName: sheet.sheetName,
      headers: sheet.headersJson,
      sampleRows: sheet.sampleRowsJson,
      detectedTables: sheet.detectedTablesJson,
      totalRows: sheet.rowCountEstimate,
    },
    null,
    2,
  );
}

async function callAnthropic(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: unknown[];
  tools: unknown[];
}): Promise<{ stop_reason: string; content: unknown[] }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": ANTHROPIC_FILES_BETA_HEADER,
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 2048,
      system: input.systemPrompt,
      tools: input.tools,
      messages: input.messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<{ stop_reason: string; content: unknown[] }>;
}

function buildSystemPrompt(
  docSheets: Array<{
    id: string;
    filename: string;
    sheetName: string;
    sheetType: string;
    rowCountEstimate: number | null;
    headersJson: unknown;
    sheetAboutJson: unknown;
  }>,
  workbookSheets: WorkbookSheetInput[],
): string {
  const parts: string[] = [
    "You are analysing an Excel workbook used for actuarial / reinsurance analysis.",
    "Your job: for each sheet in the workbook, identify input regions (cells the analyst must fill in) and output regions (calculated results).",
    "",
    "Region type key: F=formula (computed — NEVER an input), N=hardcoded number (potential input), T=hardcoded text (label/header), E=empty.",
    "Font color: blue (#4472C4 or similar) = input convention, black/empty = default.",
    "",
    "Rules:",
    "- Use fetch_source FIRST to read the ingested source documents and understand the workbook's semantic structure.",
    "- F regions are outputs (formula-driven). N regions are potential inputs.",
    "- A meaningful INPUT region: an N-type region of 2+ cells that represents data the analyst enters (triangle values, premiums, LDF selections, assumptions). Blue font strongly confirms this.",
    "- Loss triangles are triangular — the lower-right cells are empty (future periods). Report the full enclosing rectangle (e.g. B13:N22), not individual rows.",
    "- A meaningful OUTPUT region: an F-type region representing computed results.",
    "- Single isolated N cells that are clearly metadata (a date, a name) are NOT input regions.",
    "- Report address ranges in standard Excel notation (e.g. B13:N22).",
    "- If a sheet has no meaningful inputs or outputs, omit it.",
    "- Once you have enough information, call report_regions.",
    "",
  ];

  // Active workbook sheets
  parts.push("## Active Workbook Sheets");
  for (const sheet of workbookSheets) {
    parts.push(`\n**Sheet: "${sheet.sheetName}"** (${sheet.rowCount} rows × ${sheet.columnCount} cols)`);
    if (sheet.headers.length > 0) {
      parts.push(`  Row 1 (headers): ${sheet.headers.slice(0, 20).join(" | ")}`);
    }
    if (sheet.sampleRows.length > 0) {
      parts.push("  Sample values (first 8 rows):");
      for (const row of sheet.sampleRows.slice(0, 8)) {
        parts.push(`    ${row.slice(0, 15).join("\t")}`);
      }
    }
    if (sheet.regions && sheet.regions.length > 0) {
      parts.push("  Pre-classified regions (address | type | font-color):");
      for (const r of sheet.regions) {
        const colorNote = r.fontColor ? ` | font:${r.fontColor}` : "";
        parts.push(`    ${r.address} | ${r.type}${colorNote}`);
      }
    }
  }

  // Ingested source documents
  parts.push("\n## Ingested Source Documents (available via fetch_source)");
  const byDoc = new Map<string, typeof docSheets>();
  for (const s of docSheets) {
    if (!byDoc.has(s.filename)) byDoc.set(s.filename, []);
    byDoc.get(s.filename)!.push(s);
  }
  if (byDoc.size === 0) {
    parts.push("None.");
  }
  for (const [filename, sheets] of byDoc) {
    parts.push(`\n**${filename}**`);
    for (const s of sheets) {
      const about =
        s.sheetAboutJson && typeof s.sheetAboutJson === "object"
          ? ((s.sheetAboutJson as Record<string, unknown>).summary as string | undefined) ?? ""
          : "";
      parts.push(`  - Sheet "${s.sheetName}" [${s.sheetType}] (id: ${s.id})`);
      if (about) parts.push(`    ${about}`);
    }
  }

  return parts.join("\n");
}
