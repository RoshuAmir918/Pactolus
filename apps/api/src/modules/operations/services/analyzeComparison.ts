import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperationCaptures, runOperations } from "@db/schema";
import { callClaudeTool } from "../../ingestion/services/document-ingestion/anthropic/client";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type AnalyzeComparisonInput = {
  orgId: string;
  runId: string;
  operationIds: string[];
};

export type AnalyzeComparisonResult = {
  narrative: string;
};

type RegionEntry = {
  address: string;
  sheetName?: string;
  regionType: "input" | "output";
  description?: string;
  reason?: string;
  values: unknown[][];
};

function formatValue(values: unknown[][]): string {
  const flat = values.flat().filter((v) => v !== null && v !== "" && v !== undefined);
  if (values.length === 1 && values[0].length === 1) return String(values[0][0] ?? "");
  const nums = flat.map(Number).filter((n) => !isNaN(n));
  if (nums.length > 0 && nums.length === flat.length) {
    return nums.reduce((a, b) => a + b, 0).toLocaleString("en-US");
  }
  return flat.slice(0, 3).map(String).join(", ");
}

export async function analyzeComparison(
  input: AnalyzeComparisonInput,
): Promise<AnalyzeComparisonResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const opIds = input.operationIds.slice(0, 3);

  // Fetch operations and captures in parallel
  const [ops, captureRows] = await Promise.all([
    Promise.all(
      opIds.map((id) =>
        db
          .select({ parametersJson: runOperations.parametersJson })
          .from(runOperations)
          .where(and(eq(runOperations.id, id), eq(runOperations.runId, input.runId)))
          .limit(1)
          .then((r) => r[0] ?? null),
      ),
    ),
    Promise.all(
      opIds.map((id) =>
        db
          .select({ payloadJson: runOperationCaptures.payloadJson })
          .from(runOperationCaptures)
          .where(
            and(
              eq(runOperationCaptures.runOperationId, id),
              eq(runOperationCaptures.captureType, "region_values"),
            ),
          )
          .limit(1)
          .then((r) => r[0] ?? null),
      ),
    ),
  ]);

  const nodeLabels = ops.map((op, i) => {
    const p = op?.parametersJson as Record<string, unknown> | null;
    return typeof p?.label === "string" ? p.label : `Scenario ${i + 1}`;
  });

  const regionsByOp: RegionEntry[][] = captureRows.map((row) =>
    (row?.payloadJson as { regions?: RegionEntry[] } | null)?.regions ?? [],
  );

  // Build diff: regions where values differ across ops
  const regionMap = new Map<
    string,
    { reason?: string; type: "input" | "output"; vals: (unknown[][] | null)[] }
  >();

  regionsByOp.forEach((regions, i) => {
    for (const r of regions) {
      const key = `${r.sheetName ?? ""}|${r.address}`;
      if (!regionMap.has(key)) {
        regionMap.set(key, {
          reason: r.description ?? r.reason,
          type: r.regionType,
          vals: Array(opIds.length).fill(null),
        });
      }
      regionMap.get(key)!.vals[i] = r.values;
    }
  });

  const inputDiffs: string[] = [];
  const outputDiffs: string[] = [];

  for (const [, data] of regionMap) {
    const present = data.vals.filter((v) => v !== null);
    if (present.length < 2) continue;
    const serialized = data.vals.map((v) => (v ? JSON.stringify(v) : null));
    if (serialized.every((s) => s === serialized[0])) continue;

    const label = data.reason ?? "Unknown region";
    const valStr = data.vals
      .map((v, i) => (v !== null ? `${nodeLabels[i]}: ${formatValue(v)}` : null))
      .filter(Boolean)
      .join(" | ");

    const line = `${label}: ${valStr}`;
    if (data.type === "input") inputDiffs.push(line);
    else outputDiffs.push(line);
  }

  if (inputDiffs.length === 0 && outputDiffs.length === 0) {
    return { narrative: "No differences detected between the selected scenarios." };
  }

  const parts: string[] = [
    "You are analyzing differences between saved scenarios in a reinsurance workbook.",
    `Comparing: ${nodeLabels.join(" vs ")}`,
    "",
  ];
  if (inputDiffs.length > 0) {
    parts.push("Input assumption changes:");
    inputDiffs.slice(0, 6).forEach((d) => parts.push(`  - ${d}`));
    parts.push("");
  }
  if (outputDiffs.length > 0) {
    parts.push("Output changes:");
    outputDiffs.slice(0, 6).forEach((d) => parts.push(`  - ${d}`));
  }

  let narrative = [
    inputDiffs.length > 0 ? `Input changes: ${inputDiffs.slice(0, 2).join("; ")}` : null,
    outputDiffs.length > 0 ? `Output changes: ${outputDiffs.slice(0, 2).join("; ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  try {
    const result = await callClaudeTool<{ narrative: string }>({
      prompt: [
        ...parts,
        "",
        "Write 2-3 sentences describing what changed and the effect on outputs. Be specific about numbers. No bullet points.",
      ].join("\n"),
      tool: {
        name: "set_narrative",
        description: "Set the comparison narrative",
        input_schema: {
          type: "object",
          properties: {
            narrative: {
              type: "string",
              description: "2-3 sentence plain-English description of what changed and why it matters",
            },
          },
          required: ["narrative"],
        },
      },
      maxTokens: 256,
    });
    narrative = result.narrative?.trim() || narrative;
  } catch {
    // fall back to raw diff summary
  }

  return { narrative };
}
