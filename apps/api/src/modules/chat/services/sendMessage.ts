import { loadSnapshotSheets, loadSnapshotTriangles, loadRunContext, loadFocusedNode } from "./loadContext";
import { buildSystemPrompt } from "./systemPrompt";
import { callAnthropic, CHAT_TOOLS } from "./anthropicClient";
import { resolveSource } from "./resolveSource";

export type SendMessageInput = {
  orgId: string;
  snapshotId: string;
  runId: string | null;
  operationId: string | null;
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

type ContentBlock = { type: string; id?: string; name?: string; input?: unknown; text?: string };

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  // Load context from DB
  const [sheets, triangles, runCtx, focusedNode] = await Promise.all([
    loadSnapshotSheets(input.snapshotId, input.orgId),
    loadSnapshotTriangles(input.snapshotId, input.orgId),
    input.runId ? loadRunContext(input.runId) : Promise.resolve({ pipelineContext: [], captures: [] }),
    input.runId && input.operationId ? loadFocusedNode(input.runId, input.operationId) : Promise.resolve(null),
  ]);

  const systemPrompt = buildSystemPrompt(
    sheets,
    triangles,
    runCtx.pipelineContext,
    runCtx.captures,
    focusedNode,
    input.selectedRange ?? null,
  );

  const claudeMessages = input.messages.map((m) => ({ role: m.role, content: m.text }));

  // Tool-use loop — all tool_use blocks in a turn must get tool_results before the next call
  let currentMessages: unknown[] = [...claudeMessages];
  let pendingExcelAction: ExcelAction | null = null;

  for (let turn = 0; turn < 5; turn++) {
    const response = await callAnthropic({ apiKey, systemPrompt, messages: currentMessages, tools: CHAT_TOOLS });
    const content = response.content as ContentBlock[];
    const toolUseBlocks = content.filter((b) => b.type === "tool_use" && b.id && b.input);

    if (toolUseBlocks.length === 0) {
      const reply = content
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        reply: reply || "I wasn't able to generate a response. Please try rephrasing.",
        excelAction: pendingExcelAction,
      };
    }

    currentMessages = [...currentMessages, { role: "assistant" as const, content }];

    const toolResults: unknown[] = [];
    for (const toolBlock of toolUseBlocks) {
      if (toolBlock.name === "write_to_excel") {
        const ti = toolBlock.input as { start_cell: string; values: unknown[][]; sheet_name?: string; description: string };
        pendingExcelAction = {
          type: "write_range",
          startCell: ti.start_cell,
          values: ti.values,
          sheetName: ti.sheet_name,
          description: ti.description,
        };
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: "Data staged. A Paste button will appear in the chat. Tell the user to click it.",
        });
      } else if (toolBlock.name === "fetch_source") {
        const ti = toolBlock.input as { source_type: string; source_id: string; reason: string };
        const fetched = await resolveSource(ti.source_type, ti.source_id, input.orgId);
        toolResults.push({ type: "tool_result", tool_use_id: toolBlock.id, content: fetched });
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: `Unknown tool: ${toolBlock.name}`,
          is_error: true,
        });
      }
    }

    currentMessages = [...currentMessages, { role: "user" as const, content: toolResults }];
  }

  return {
    reply: "I wasn't able to generate a response after several attempts. Please try again.",
    excelAction: pendingExcelAction,
  };
}
