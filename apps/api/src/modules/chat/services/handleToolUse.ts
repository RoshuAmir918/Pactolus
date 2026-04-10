import { resolveSource } from "./resolveSource";
import type { ExcelAction } from "./sendMessage";

type ContentBlock = { type: string; id?: string; name?: string; input?: unknown; text?: string };

export type ToolUseResult = {
  toolResults: unknown[];
  excelAction: ExcelAction | null;
};

export async function handleToolUse(
  toolUseBlocks: ContentBlock[],
  orgId: string,
): Promise<ToolUseResult> {
  const toolResults: unknown[] = [];
  let excelAction: ExcelAction | null = null;

  for (const toolBlock of toolUseBlocks) {
    if (toolBlock.name === "write_to_excel") {
      const ti = toolBlock.input as {
        start_cell: string;
        values: unknown[][];
        sheet_name?: string;
        description: string;
      };
      excelAction = {
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
      const fetched = await resolveSource(ti.source_type, ti.source_id, orgId);
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

  return { toolResults, excelAction };
}
