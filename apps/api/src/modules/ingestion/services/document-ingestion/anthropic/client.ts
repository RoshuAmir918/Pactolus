import type { ClaudeToolDefinition } from "../shared/types";

const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

// Global concurrency cap across all ingestion Claude calls.
// Keeps parallel triangle/sheet extraction from bursting into rate limits.
const MAX_CONCURRENT_INGESTION_CALLS = Number(process.env.INGESTION_MAX_CONCURRENT_CLAUDE_CALLS ?? 3);
let activeIngestionCalls = 0;
const ingestionQueue: Array<() => void> = [];

async function acquireIngestionSlot(): Promise<void> {
  if (activeIngestionCalls < MAX_CONCURRENT_INGESTION_CALLS) {
    activeIngestionCalls++;
    return;
  }
  return new Promise((resolve) => {
    ingestionQueue.push(() => {
      activeIngestionCalls++;
      resolve();
    });
  });
}

function releaseIngestionSlot(): void {
  activeIngestionCalls--;
  const next = ingestionQueue.shift();
  if (next) next();
}

export async function callClaudeTool<T extends Record<string, unknown>>(input: {
  prompt: string;
  tool: ClaudeToolDefinition;
  maxTokens: number;
  contentBlocks?: Array<Record<string, unknown>>;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const model = resolveClaudeModel(process.env.CLAUDE_MODEL);

  const messagesContent =
    input.contentBlocks && input.contentBlocks.length > 0
      ? [{ type: "text", text: input.prompt }, ...input.contentBlocks]
      : input.prompt;

  const requestBody = JSON.stringify({
    model,
    max_tokens: input.maxTokens,
    temperature: 0.1,
    tools: [input.tool],
    tool_choice: { type: "tool", name: input.tool.name },
    messages: [{ role: "user", content: messagesContent }],
  });

  const MAX_RETRIES = 4;
  let delay = 15_000;
  let response: Response | undefined;

  await acquireIngestionSlot();
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: requestBody,
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0) * 1000;
        await new Promise((r) => setTimeout(r, retryAfter || delay));
        delay = Math.min(delay * 2, 60_000);
        continue;
      }
      break;
    }
  } finally {
    releaseIngestionSlot();
  }

  if (!response?.ok) {
    throw new Error(`Anthropic tool error ${response?.status}: ${await response?.text()}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const toolUse = data.content?.find(
    (item) => item.type === "tool_use" && item.name === input.tool.name,
  );
  const toolInput = toolUse?.input;
  if (!toolInput || typeof toolInput !== "object") {
    throw new Error(`Anthropic tool output missing for ${input.tool.name}`);
  }
  return toolInput as T;
}

function resolveClaudeModel(configuredModel: string | undefined): string {
  const model = configuredModel?.trim();
  if (!model || model.endsWith("-latest")) {
    return DEFAULT_CLAUDE_MODEL;
  }
  return model;
}
