const ANTHROPIC_FILES_BETA_HEADER = "files-api-2025-04-14";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function callAnthropic(input: {
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

export const CHAT_TOOLS = [
  {
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
          enum: ["document_sheet", "run_pipeline_context", "run_step_capture", "operation_note"],
          description: "Whether to fetch a document sheet, pipeline context entry, analyst capture, or analyst note",
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
  },
  {
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
  },
];
