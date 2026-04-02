import { buildSnapshotAnthropicFileBlocks } from "../files/anthropicFiles";
import type { ClaudeToolDefinition } from "../shared/types";

const ANTHROPIC_FILES_BETA_HEADER = "files-api-2025-04-14";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

export async function callClaudeTool<T extends Record<string, unknown>>(input: {
  prompt: string;
  tool: ClaudeToolDefinition;
  maxTokens: number;
  contentBlocks?: Array<Record<string, unknown>>;
  snapshotId?: string;
  includeSnapshotFiles?: boolean;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const model = resolveClaudeModel(process.env.CLAUDE_MODEL);
  const messagesContent = await buildClaudeMessagesContent({
    prompt: input.prompt,
    snapshotId: input.snapshotId,
    includeSnapshotFiles: input.includeSnapshotFiles,
    contentBlocks: input.contentBlocks,
  });

  const requestBody = JSON.stringify({
    model,
    max_tokens: input.maxTokens,
    temperature: 0.1,
    tools: [input.tool],
    tool_choice: {
      type: "tool",
      name: input.tool.name,
    },
    messages: [{ role: "user", content: messagesContent }],
  });

  const MAX_RETRIES = 4;
  let delay = 15_000;
  let response: Response | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": ANTHROPIC_FILES_BETA_HEADER,
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

  if (!response!.ok) {
    throw new Error(`Anthropic tool error ${response!.status}: ${await response!.text()}`);
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

async function buildClaudeMessagesContent(input: {
  prompt: string;
  snapshotId?: string;
  includeSnapshotFiles?: boolean;
  contentBlocks?: Array<Record<string, unknown>>;
}) {
  const snapshotFileBlocks =
    input.includeSnapshotFiles && input.snapshotId
      ? await buildSnapshotAnthropicFileBlocks(input.snapshotId)
      : [];

  if (input.contentBlocks && input.contentBlocks.length > 0) {
    return [{ type: "text", text: input.prompt }, ...snapshotFileBlocks, ...input.contentBlocks];
  }
  if (snapshotFileBlocks.length > 0) {
    return [{ type: "text", text: input.prompt }, ...snapshotFileBlocks];
  }
  return input.prompt;
}

function resolveClaudeModel(configuredModel: string | undefined): string {
  const model = configuredModel?.trim();
  if (!model) {
    return DEFAULT_CLAUDE_MODEL;
  }

  // Legacy aliases like "claude-sonnet-4-5" can return 404 on some accounts.
  if (model.endsWith("-latest")) {
    return DEFAULT_CLAUDE_MODEL;
  }

  return model;
}
