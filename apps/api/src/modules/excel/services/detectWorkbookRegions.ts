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
  inputRegions: Array<{ address: string; description: string; reason: string; confidencePercent: number; colHeaderAddress?: string; rowHeaderAddress?: string }>;
  outputRegions: Array<{ address: string; description: string; reason: string; confidencePercent: number; colHeaderAddress?: string; rowHeaderAddress?: string }>;
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

  const systemPrompt = buildSystemPrompt(input.sheets);

  const reportRegionsTool = {
    name: "report_regions",
    description: "Report the identified input and output regions across the workbook sheets.",
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
                    description: { type: "string", description: "Short user-facing label, e.g. 'Loss development triangle'. No internal reasoning." },
                    reason: { type: "string", description: "Internal reasoning for why this is an input region" },
                    confidence_percent: { type: "number" },
                    col_header_address: { type: "string", description: "Address of the row containing column headers, e.g. B12:N12. Omit if none." },
                    row_header_address: { type: "string", description: "Address of the column containing row labels, e.g. A13:A22. Omit if none." },
                  },
                  required: ["address", "description", "reason", "confidence_percent"],
                },
              },
              output_regions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    description: { type: "string", description: "Short user-facing label, e.g. 'Net loss ratio'. No internal reasoning." },
                    reason: { type: "string" },
                    confidence_percent: { type: "number" },
                    col_header_address: { type: "string", description: "Address of the row containing column headers. Omit if none." },
                    row_header_address: { type: "string", description: "Address of the column containing row labels. Omit if none." },
                  },
                  required: ["address", "description", "reason", "confidence_percent"],
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

  const model = process.env.CLAUDE_MODEL?.trim()?.replace(/-latest$/, "") ?? DEFAULT_MODEL;

  const response = await callAnthropic({
    apiKey,
    model,
    systemPrompt,
    messages: [
      {
        role: "user",
        content: "Analyse the workbook sheets and identify all input and output regions. Call report_regions with your findings.",
      },
    ],
    tools: [reportRegionsTool],
  });

  type ContentBlock = { type: string; id?: string; name?: string; input?: unknown };
  const content = response.content as ContentBlock[];
  const reportBlock = content.find((b) => b.type === "tool_use" && b.name === "report_regions");

  if (!reportBlock?.input) {
    return { sheets: [], promptMessage: null };
  }

  const toolInput = reportBlock.input as {
    sheets: Array<{
      sheet_name: string;
      input_regions: Array<{ address: string; description: string; reason: string; confidence_percent: number; col_header_address?: string; row_header_address?: string }>;
      output_regions: Array<{ address: string; description: string; reason: string; confidence_percent: number; col_header_address?: string; row_header_address?: string }>;
    }>;
    prompt_message: string | null;
  };

  const sheets: DetectedSheetRegions[] = toolInput.sheets.map((s) => ({
    sheetName: s.sheet_name,
    inputRegions: s.input_regions.map((r) => ({
      address: r.address,
      description: r.description,
      reason: r.reason,
      confidencePercent: r.confidence_percent,
      colHeaderAddress: r.col_header_address,
      rowHeaderAddress: r.row_header_address,
    })),
    outputRegions: s.output_regions.map((r) => ({
      address: r.address,
      description: r.description,
      reason: r.reason,
      confidencePercent: r.confidence_percent,
      colHeaderAddress: r.col_header_address,
      rowHeaderAddress: r.row_header_address,
    })),
  }));

  return { sheets, promptMessage: toolInput.prompt_message ?? null };
}

async function callAnthropic(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: unknown[];
  tools: unknown[];
}): Promise<{ stop_reason: string; content: unknown[] }> {
  const body = JSON.stringify({
    model: input.model,
    max_tokens: 2048,
    system: input.systemPrompt,
    tools: input.tools,
    tool_choice: { type: "tool", name: "report_regions" },
    messages: input.messages,
  });

  const MAX_RETRIES = 3;
  let delay = 5_000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0) * 1000;
      await new Promise((r) => setTimeout(r, retryAfter || delay));
      delay = Math.min(delay * 2, 30_000);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<{ stop_reason: string; content: unknown[] }>;
  }

  throw new Error("Anthropic API rate limit exceeded after retries.");
}

function buildSystemPrompt(workbookSheets: WorkbookSheetInput[]): string {
  const parts: string[] = [
    "You are analysing an Excel workbook used for actuarial / reinsurance analysis.",
    "Your job: for each sheet, identify input regions (cells the analyst must fill in) and output regions (calculated results).",
    "",
    "Region type key: F=formula (computed — NEVER an input), N=hardcoded number (potential input), T=hardcoded text (label/header), E=empty.",
    "Font color: blue (#4472C4 or similar) = input convention.",
    "",
    "Rules:",
    "- F regions are outputs. N regions are potential inputs.",
    "- A meaningful INPUT region: an N-type range of 2+ cells representing data the analyst enters (triangle values, premiums, LDF selections, assumptions). Blue font strongly confirms this.",
    "- Loss triangles are triangular — lower-right cells are empty (future periods). Report the full enclosing rectangle (e.g. B13:N22).",
    "- A meaningful OUTPUT region: an F-type range representing computed results.",
    "- Single isolated N cells that are clearly metadata (a date, a name) are NOT input regions.",
    "- Report addresses in standard Excel notation (e.g. B13:N22).",
    "- If a sheet has no meaningful inputs or outputs, omit it.",
    "",
    "## Workbook Sheets",
  ];

  for (const sheet of workbookSheets) {
    parts.push(`\n**Sheet: "${sheet.sheetName}"** (${sheet.rowCount} rows × ${sheet.columnCount} cols)`);
    if (sheet.headers.length > 0) {
      parts.push(`  Headers: ${sheet.headers.slice(0, 12).join(" | ")}`);
    }
    if (sheet.sampleRows.length > 0) {
      parts.push("  Sample (first 5 rows):");
      for (const row of sheet.sampleRows.slice(0, 5)) {
        parts.push(`    ${row.slice(0, 10).join("\t")}`);
      }
    }
    if (sheet.regions && sheet.regions.length > 0) {
      const meaningful = sheet.regions.filter((r) => r.type === "N" || r.type === "F").slice(0, 40);
      if (meaningful.length > 0) {
        parts.push("  Regions (address | type | font):");
        for (const r of meaningful) {
          const colorNote = r.fontColor ? ` | ${r.fontColor}` : "";
          parts.push(`    ${r.address} | ${r.type}${colorNote}`);
        }
      }
    }
  }

  return parts.join("\n");
}
