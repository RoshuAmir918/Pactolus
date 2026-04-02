import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import {
  documentSheets,
  documents,
  runPipelineContext,
  runOperationCaptures,
  runOperations,
} from "@db/schema";

const { db } = dbClient;

const ANTHROPIC_FILES_BETA_HEADER = "files-api-2025-04-14";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export type SendMessageInput = {
  orgId: string;
  snapshotId: string;
  runId: string | null;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  selectedRange?: string | null;
};

export type ExcelAction = {
  type: "write_range";
  startCell: string;
  values: unknown[][];
  sheetName?: string;
  description: string;
};

export type SendMessageResult = {
  reply: string;
  excelAction?: ExcelAction | null;
};

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  // 1. Load sheet metadata for all documents in this snapshot
  const sheets = await db
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

  // 2a. Load pipeline context for the run (excluding raw AI responses)
  type PipelineContextRow = { id: string; operationType: string; contextType: string; dataJson: unknown };
  let pipelineContextRows: PipelineContextRow[] = [];

  if (input.runId) {
    const rows = await db
      .select({
        id: runPipelineContext.id,
        operationType: runOperations.operationType,
        contextType: runPipelineContext.contextType,
        dataJson: runPipelineContext.dataJson,
      })
      .from(runPipelineContext)
      .innerJoin(runOperations, eq(runOperations.id, runPipelineContext.runStepId))
      .where(eq(runOperations.runId, input.runId))
      .orderBy(runOperations.operationIndex);

    pipelineContextRows = rows.filter((a) => a.contextType !== "AI_RAW_RESPONSE");
  }

  // 2b. Load analyst captures for the run (narrative, output values)
  type CaptureRow = { id: string; operationType: string; captureType: string; summaryText: string | null };
  let captureRows: CaptureRow[] = [];

  if (input.runId) {
    captureRows = await db
      .select({
        id: runOperationCaptures.id,
        operationType: runOperations.operationType,
        captureType: runOperationCaptures.captureType,
        summaryText: runOperationCaptures.summaryText,
      })
      .from(runOperationCaptures)
      .innerJoin(runOperations, eq(runOperations.id, runOperationCaptures.runOperationId))
      .where(eq(runOperations.runId, input.runId))
      .orderBy(runOperations.operationIndex);
  }

  // 3. Build system prompt with metadata
  const systemPrompt = buildSystemPrompt(sheets, pipelineContextRows, captureRows, input.selectedRange ?? null);

  // 4. Convert messages to Anthropic format
  const claudeMessages = input.messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  // 5. Tool definitions
  const writeToExcelTool = {
    name: "write_to_excel",
    description:
      "Stage data for the user to paste into their Excel worksheet. " +
      "Calling this tool does NOT paste immediately — it shows a confirmation button the user must click. " +
      "Use this whenever the user asks to paste, insert, write, or add data to their sheet. " +
      "Include headers as the first row. Values can be strings or numbers.",
    input_schema: {
      type: "object",
      properties: {
        start_cell: {
          type: "string",
          description: "Top-left cell address to start writing, e.g. 'A1'",
        },
        values: {
          type: "array",
          description: "2D array of values. First row should be column headers.",
          items: { type: "array", items: {} },
        },
        sheet_name: {
          type: "string",
          description: "Sheet name to write to (optional — defaults to the active sheet)",
        },
        description: {
          type: "string",
          description: "One-sentence summary of what is being written, shown to the user before they confirm",
        },
      },
      required: ["start_cell", "values", "description"],
    },
  };

  const fetchSourceTool = {
    name: "fetch_source",
    description:
      "Retrieve detailed data from a specific source document sheet or analysis artifact. " +
      "Use this when the metadata summary above is not enough to answer the question — " +
      "for example, when you need actual row values, table data, or the full artifact output.",
    input_schema: {
      type: "object",
      properties: {
        source_type: {
          type: "string",
          enum: ["document_sheet", "run_pipeline_context", "run_step_capture"],
          description: "Whether to fetch a document sheet, pipeline context entry, or analyst capture",
        },
        source_id: {
          type: "string",
          description: "The UUID shown in the context above",
        },
        reason: {
          type: "string",
          description: "Brief explanation of why you need this data",
        },
      },
      required: ["source_type", "source_id", "reason"],
    },
  };

  const tools = [fetchSourceTool, writeToExcelTool];

  // 6. Tool-use loop — handles sequential calls (e.g. fetch_source → write_to_excel)
  type ContentBlock = { type: string; id?: string; name?: string; input?: unknown; text?: string };

  let currentMessages: unknown[] = [...claudeMessages];
  let pendingExcelAction: ExcelAction | null = null;

  for (let turn = 0; turn < 5; turn++) {
    const response = await callAnthropic({ apiKey, systemPrompt, messages: currentMessages, tools });
    const content = response.content as ContentBlock[];

    const toolUseBlock = content.find((b) => b.type === "tool_use");

    // No tool call — Claude is done
    if (!toolUseBlock?.id || !toolUseBlock.input) {
      const textBlock = content.find((b) => b.type === "text");
      return {
        reply: textBlock?.text ?? "No response generated.",
        excelAction: pendingExcelAction,
      };
    }

    // Append assistant turn to message history
    currentMessages = [
      ...currentMessages,
      { role: "assistant" as const, content },
    ];

    if (toolUseBlock.name === "write_to_excel") {
      const toolInput = toolUseBlock.input as {
        start_cell: string;
        values: unknown[][];
        sheet_name?: string;
        description: string;
      };
      pendingExcelAction = {
        type: "write_range",
        startCell: toolInput.start_cell,
        values: toolInput.values,
        sheetName: toolInput.sheet_name,
        description: toolInput.description,
      };
      currentMessages = [
        ...currentMessages,
        {
          role: "user" as const,
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              content: "Data staged. A Paste button will appear in the chat. Tell the user to click it.",
            },
          ],
        },
      ];
    } else if (toolUseBlock.name === "fetch_source") {
      const toolInput = toolUseBlock.input as {
        source_type: string;
        source_id: string;
        reason: string;
      };
      const fetchedContent = await resolveSource(toolInput.source_type, toolInput.source_id, input.orgId);
      currentMessages = [
        ...currentMessages,
        {
          role: "user" as const,
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              content: fetchedContent,
            },
          ],
        },
      ];
    } else {
      // Unknown tool — return whatever text Claude produced
      const textBlock = content.find((b) => b.type === "text");
      return {
        reply: textBlock?.text ?? "No response generated.",
        excelAction: pendingExcelAction,
      };
    }
  }

  return { reply: "No response generated.", excelAction: pendingExcelAction };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function resolveSource(
  sourceType: string,
  sourceId: string,
  orgId: string,
): Promise<string> {
  if (sourceType === "document_sheet") {
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

  if (sourceType === "run_pipeline_context") {
    const [ctx] = await db
      .select({
        contextType: runPipelineContext.contextType,
        dataJson: runPipelineContext.dataJson,
      })
      .from(runPipelineContext)
      .where(eq(runPipelineContext.id, sourceId))
      .limit(1);

    if (!ctx) return "Pipeline context not found.";
    return JSON.stringify(ctx.dataJson, null, 2);
  }

  if (sourceType === "run_step_capture") {
    const [cap] = await db
      .select({ payloadJson: runOperationCaptures.payloadJson })
      .from(runOperationCaptures)
      .where(eq(runOperationCaptures.id, sourceId))
      .limit(1);

    if (!cap) return "Capture not found.";
    return JSON.stringify(cap.payloadJson, null, 2);
  }

  return "Unknown source type.";
}

async function callAnthropic(input: {
  apiKey: string;
  systemPrompt: string;
  messages: unknown[];
  tools: unknown[];
}): Promise<{ stop_reason: string; content: unknown[] }> {
  const model = process.env.CLAUDE_MODEL?.trim()?.replace(/-latest$/, "") ?? DEFAULT_MODEL;

  const body = JSON.stringify({
    model,
    max_tokens: 4096,
    system: input.systemPrompt,
    tools: input.tools,
    messages: input.messages,
  });

  const MAX_RETRIES = 4;
  let delay = 15_000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": ANTHROPIC_FILES_BETA_HEADER,
      },
      body,
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0) * 1000;
      await new Promise((r) => setTimeout(r, retryAfter || delay));
      delay = Math.min(delay * 2, 60_000);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<{ stop_reason: string; content: unknown[] }>;
  }

  throw new Error("Anthropic API rate limit exceeded after retries.");
}

function buildSystemPrompt(
  sheets: Array<{
    id: string;
    filename: string;
    sheetName: string;
    sheetType: string;
    rowCountEstimate: number | null;
    headersJson: unknown;
    sheetAboutJson: unknown;
  }>,
  pipelineContext: Array<{
    id: string;
    operationType: string;
    contextType: string;
    dataJson: unknown;
  }>,
  captures: Array<{
    id: string;
    operationType: string;
    captureType: string;
    summaryText: string | null;
  }>,
  selectedRange: string | null,
): string {
  const parts: string[] = [
    "You are an actuarial analysis assistant embedded in Pactolus, a reinsurance analytics platform.",
    "",
    "## Response style",
    "- Match depth to the question. Short question → short answer. Don't volunteer every observation unprompted.",
    "- Lead with the direct answer, then stop. Offer to go deeper only if genuinely useful.",
    "- Use markdown: headers for structure, tables for data, bold for key numbers. Keep it tight.",
    "- No emoji. No preamble ('Great question!'). No summaries at the end.",
    "",
    "## Tools",
    "",
    "### fetch_source",
    "Call this when you need detailed row-level data from a specific sheet or artifact.",
    "Only fetch when the metadata summary below is genuinely insufficient to answer.",
    "",
    "### write_to_excel",
    "Call this whenever the user asks you to paste, insert, write, or populate data into their spreadsheet.",
    "IMPORTANT: calling this tool does NOT paste immediately. It stages the data and shows a Paste button the user must click to confirm.",
    "After calling it, your reply should be brief — just tell the user to click the Paste button.",
    "Never describe writing data without calling this tool — always call it if the user wants something in their sheet.",
    "If the data was shown earlier in the conversation as a table, reconstruct the 2D values array from that and call the tool.",
    "",
  ];

  if (selectedRange) {
    parts.push(`User's selected Excel range: ${selectedRange}`, "");
  }

  // Group sheets by document filename
  const byDoc = new Map<string, typeof sheets>();
  for (const sheet of sheets) {
    if (!byDoc.has(sheet.filename)) byDoc.set(sheet.filename, []);
    byDoc.get(sheet.filename)!.push(sheet);
  }

  parts.push("## Source Documents");
  if (byDoc.size === 0) {
    parts.push("No source documents ingested for this snapshot.");
  }
  for (const [filename, docSheets] of byDoc) {
    parts.push(`\n**${filename}**`);
    for (const sheet of docSheets) {
      const about =
        sheet.sheetAboutJson && typeof sheet.sheetAboutJson === "object"
          ? ((sheet.sheetAboutJson as Record<string, unknown>).summary as string | undefined) ?? ""
          : "";
      const headers = Array.isArray(sheet.headersJson)
        ? sheet.headersJson.slice(0, 20).join(", ")
        : "";
      const rowsLabel = sheet.rowCountEstimate != null ? ` | ~${sheet.rowCountEstimate} rows` : "";
      parts.push(
        `  - Sheet "${sheet.sheetName}" [${sheet.sheetType}${rowsLabel}] (id: ${sheet.id})`,
      );
      if (headers) parts.push(`    Headers: ${headers}`);
      if (about) parts.push(`    About: ${about}`);
    }
  }

  if (pipelineContext.length > 0) {
    parts.push("\n## Pipeline Context (this branch)");
    for (const ctx of pipelineContext) {
      const summary = summarizePipelineContext(ctx.contextType, ctx.dataJson);
      parts.push(`  - ${ctx.contextType} from operation "${ctx.operationType}" (id: ${ctx.id})`);
      if (summary) parts.push(`    ${summary}`);
    }
  }

  if (captures.length > 0) {
    parts.push("\n## Analyst Captures (this branch)");
    for (const cap of captures) {
      if (cap.summaryText) {
        parts.push(`  - [${cap.captureType}] ${cap.summaryText}`);
      }
    }
  }

  return parts.join("\n");
}

function summarizePipelineContext(contextType: string, dataJson: unknown): string {
  if (!dataJson || typeof dataJson !== "object") return "";
  const data = dataJson as Record<string, unknown>;

  if (contextType === "CANONICALIZATION_SUMMARY") {
    return typeof data.summary === "string" ? data.summary.slice(0, 300) : "";
  }
  if (contextType === "MAPPING_VALIDATION_REPORT") {
    const issues = Array.isArray(data.issues) ? data.issues.length : 0;
    return issues > 0 ? `${issues} validation issue(s) found` : "Validation passed";
  }
  return "";
}
