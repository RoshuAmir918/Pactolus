import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { documentSheets, documents } from "@db/schema";
import type { WorkbookSheetInput } from "./detectWorkbookRegions";

const { db } = dbClient;

const ANTHROPIC_FILES_BETA_HEADER = "files-api-2025-04-14";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export type AssumptionItem = {
  key: string;
  value: string;
  unit: string | null;
  confidence: number;
  rationale: string;
};

export type ExtractScenarioAssumptionsResult = {
  assumptions: AssumptionItem[];
};

export async function extractScenarioAssumptions(input: {
  orgId: string;
  snapshotId: string;
  sheets: WorkbookSheetInput[];
}): Promise<ExtractScenarioAssumptionsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

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
    description: "Retrieve detailed data from a specific ingested source document sheet for additional context.",
    input_schema: {
      type: "object",
      properties: {
        source_id: { type: "string", description: "UUID of the document_sheet" },
        reason: { type: "string", description: "Why you need this data" },
      },
      required: ["source_id", "reason"],
    },
  };

  const reportAssumptionsTool = {
    name: "report_assumptions",
    description:
      "Report all actuarial assumptions identified in the workbook. Call once you have analysed the relevant sheets.",
    input_schema: {
      type: "object",
      properties: {
        assumptions: {
          type: "array",
          description: "List of named assumptions extracted from the workbook",
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description:
                  "Short descriptive name for the assumption, e.g. 'LDF AY2020 12-24', 'Trend factor', 'ELR selected', 'Development method'",
              },
              value: {
                type: "string",
                description: "The value as it appears in the cell, e.g. '1.150', '3.0%', 'Bornhuetter-Ferguson'",
              },
              unit: {
                type: "string",
                nullable: true,
                description: "Unit if applicable, e.g. '%', 'months', null otherwise",
              },
              confidence: {
                type: "number",
                description: "Confidence 0–1 that this is a meaningful analyst-entered assumption",
              },
              rationale: {
                type: "string",
                description: "One sentence explaining why this is an assumption and what it represents",
              },
            },
            required: ["key", "value", "confidence", "rationale"],
          },
        },
      },
      required: ["assumptions"],
    },
  };

  type ContentBlock = { type: string; id?: string; name?: string; input?: unknown; text?: string };

  let currentMessages: unknown[] = [
    {
      role: "user",
      content:
        "Analyse the workbook and extract all actuarial assumptions the analyst has entered. Call report_assumptions with your findings.",
    },
  ];

  const model = process.env.CLAUDE_MODEL?.trim()?.replace(/-latest$/, "") ?? DEFAULT_MODEL;

  for (let turn = 0; turn < 5; turn++) {
    const response = await callAnthropic({
      apiKey,
      model,
      systemPrompt,
      messages: currentMessages,
      tools: [fetchSourceTool, reportAssumptionsTool],
    });
    const content = response.content as ContentBlock[];

    const toolUseBlocks = content.filter((b) => b.type === "tool_use" && b.id && b.input);
    if (toolUseBlocks.length === 0) return { assumptions: [] };

    currentMessages = [...currentMessages, { role: "assistant" as const, content }];

    const reportBlock = toolUseBlocks.find((b) => b.name === "report_assumptions");
    if (reportBlock) {
      const toolInput = reportBlock.input as { assumptions: AssumptionItem[] };
      const assumptions: AssumptionItem[] = toolInput.assumptions
        .filter((a) => a.confidence >= 0.6)
        .map((a) => ({
          key: a.key,
          value: a.value,
          unit: a.unit ?? null,
          confidence: a.confidence,
          rationale: a.rationale,
        }));
      return { assumptions };
    }

    // Resolve fetch_source calls
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (b) => {
        if (b.name === "fetch_source") {
          const toolInput = b.input as { source_id: string; reason: string };
          const content = await resolveDocumentSheet(toolInput.source_id, input.orgId);
          return { type: "tool_result", tool_use_id: b.id!, content };
        }
        return { type: "tool_result", tool_use_id: b.id!, content: "Unknown tool." };
      }),
    );

    currentMessages = [...currentMessages, { role: "user" as const, content: toolResults }];
  }

  return { assumptions: [] };
}

// ── helpers ────────────────────────────────────────────────────────────────────

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
    "Your task: identify and extract every named assumption the analyst has entered into the workbook.",
    "",
    "What counts as an assumption:",
    "- Hardcoded numbers in input regions: LDF selections, trend factors, credibility weights, ELRs, loss ratios, expense ratios, discount rates",
    "- Method choices: development method (BF vs CL vs Cape Cod), tail selections, interpolation methods",
    "- Period selections: accident years, policy years, evaluation dates",
    "- Any N-type (hardcoded number) or T-type (hardcoded text) value in a cell the analyst explicitly chose",
    "",
    "What does NOT count:",
    "- Formula outputs (F-type cells) — these are calculations, not assumptions",
    "- Column/row headers and labels",
    "- Dates or metadata that are not analytical inputs",
    "",
    "Cell type key: F=formula, N=hardcoded number, T=hardcoded text, E=empty.",
    "Blue font (#4472C4) = input convention — strongly indicates an analyst-entered assumption.",
    "",
    "Instructions:",
    "- Use fetch_source to read ingested source documents for context about what the workbook represents.",
    "- For each distinct assumption, give it a descriptive key (e.g. 'LDF 12-24 months AY2019', 'Selected tail factor', 'Credibility weight').",
    "- Report only assumptions with confidence ≥ 0.6.",
    "- Call report_assumptions once with the complete list.",
    "",
  ];

  parts.push("## Active Workbook Sheets");
  for (const sheet of workbookSheets) {
    parts.push(`\n**Sheet: "${sheet.sheetName}"** (${sheet.rowCount} rows × ${sheet.columnCount} cols)`);
    if (sheet.headers.length > 0) {
      parts.push(`  Headers: ${sheet.headers.slice(0, 20).join(" | ")}`);
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

  parts.push("\n## Ingested Source Documents (available via fetch_source)");
  const byDoc = new Map<string, typeof docSheets>();
  for (const s of docSheets) {
    if (!byDoc.has(s.filename)) byDoc.set(s.filename, []);
    byDoc.get(s.filename)!.push(s);
  }
  if (byDoc.size === 0) parts.push("None.");
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
