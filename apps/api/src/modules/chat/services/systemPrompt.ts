import type { SheetRow, PipelineContextRow, CaptureRow, FocusedNode } from "./loadContext";

export function buildSystemPrompt(
  sheets: SheetRow[],
  pipelineContext: PipelineContextRow[],
  captures: CaptureRow[],
  focusedNode: FocusedNode | null,
  selectedRange: string | null,
): string {
  const parts: string[] = [
    "You are an actuarial analysis assistant embedded in Pactolus, a reinsurance analytics platform.",
    "",
    "## Response style",
    "- Be concise. Default to 1-3 sentences. Only go longer if the question clearly requires it.",
    "- For vague or open-ended questions, ask one clarifying question rather than dumping everything you know.",
    "- Plain prose by default. No markdown headers, tables, or bullet lists unless the user explicitly asks for a breakdown or comparison.",
    "- Bold only truly critical numbers. Never use headers in a conversational reply.",
    "- No preamble ('Great question!', 'Sure!', 'Of course!'). No closing summaries. Just answer.",
    "- If you'd need to fetch data to give a complete answer, say what you'd look at and ask if they want you to pull it up.",
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

  if (focusedNode) {
    const savedAt = focusedNode.createdAt
      ? new Date(focusedNode.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
    parts.push("## Focused Node (user is currently viewing this save point)");
    parts.push(
      `**${focusedNode.label ?? "Saved"}** — operation #${focusedNode.operationIndex}${savedAt ? ` — ${savedAt}` : ""}`,
    );
    if (focusedNode.noteText) {
      parts.push(`\n**Analyst note:** ${focusedNode.noteText}`);
    }
    if (focusedNode.captures.length > 0) {
      parts.push(
        "\n**Captures** (use fetch_source with source_type=run_step_capture and the capture id for full data):",
      );
      for (const cap of focusedNode.captures) {
        const summary = cap.summaryText ? ` — ${cap.summaryText}` : "";
        parts.push(`  - [${cap.captureType}]${summary} (id: ${cap.id})`);
      }
      if (focusedNode.noteText === null) {
        parts.push("\nNo analyst note recorded yet for this node.");
      }
    }
    parts.push("");
  }

  if (selectedRange) {
    parts.push(`User's selected Excel range: ${selectedRange}`, "");
  }

  const byDoc = new Map<string, SheetRow[]>();
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
      parts.push(`  - Sheet "${sheet.sheetName}" [${sheet.sheetType}${rowsLabel}] (id: ${sheet.id})`);
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
    parts.push(
      "Use fetch_source with source_type=run_step_capture and the capture id to retrieve full data for any of these.",
    );
    for (const cap of captures) {
      const summary = cap.summaryText ? ` — ${cap.summaryText}` : "";
      parts.push(`  - [${cap.captureType}]${summary} (id: ${cap.id})`);
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
