import { and, eq, isNull, ne } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperationCaptures, runOperations, runs, snapshots } from "@db/schema";
import { callClaudeTool } from "../../ingestion/services/document-ingestion/anthropic/client";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GenerateOperationLabelInput = {
  orgId: string;
  runId: string;
  operationId: string;
};

export type GenerateOperationLabelResult = {
  label: string;
};

export async function generateOperationLabel(
  input: GenerateOperationLabelInput,
): Promise<GenerateOperationLabelResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  // 1. Load the operation
  const [op] = await db
    .select()
    .from(runOperations)
    .where(eq(runOperations.id, input.operationId))
    .limit(1);

  if (!op) throw new Error("Operation not found");

  // 2. Load captures for this operation
  const captures = await db
    .select()
    .from(runOperationCaptures)
    .where(eq(runOperationCaptures.runOperationId, input.operationId));

  // 3. Workbook name from parametersJson (set by add-in at save time), fall back to snapshot label
  const opParams = op.parametersJson as Record<string, unknown> | null;
  const workbookName = typeof opParams?.workbookName === "string" ? opParams.workbookName : null;

  const [run] = await db
    .select({ snapshotId: runs.snapshotId })
    .from(runs)
    .where(eq(runs.id, input.runId))
    .limit(1);

  const snapshotLabel = run
    ? await db
        .select({ label: snapshots.label })
        .from(snapshots)
        .where(eq(snapshots.id, run.snapshotId))
        .limit(1)
        .then((r) => r[0]?.label ?? null)
    : null;

  // 4. Load parent label for context
  let parentLabel: string | null = null;
  if (op.parentOperationId) {
    const [parent] = await db
      .select({ parametersJson: runOperations.parametersJson })
      .from(runOperations)
      .where(eq(runOperations.id, op.parentOperationId))
      .limit(1);
    if (parent) {
      const p = parent.parametersJson as Record<string, unknown> | null;
      parentLabel = typeof p?.label === "string" ? p.label : null;
    }
  }

  // 5. Collect existing sibling labels for deduplication
  const parentCondition = op.parentOperationId
    ? eq(runOperations.parentOperationId, op.parentOperationId)
    : isNull(runOperations.parentOperationId);

  const siblings = await db
    .select({ parametersJson: runOperations.parametersJson })
    .from(runOperations)
    .where(
      and(
        eq(runOperations.runId, input.runId),
        eq(runOperations.operationType, "scenario_snapshot"),
        ne(runOperations.id, input.operationId),
        parentCondition,
      ),
    );

  const siblingLabels = new Set(
    siblings
      .map((s) => (s.parametersJson as Record<string, unknown> | null)?.label)
      .filter((l): l is string => typeof l === "string"),
  );

  // 6. Extract captures
  const narrativeCapture = captures.find((c) => c.captureType === "narrative");
  // region_values is the new format (input + output with reason); output_values is legacy
  const regionCapture =
    captures.find((c) => c.captureType === "region_values") ??
    captures.find((c) => c.captureType === "output_values");

  const narrativeText =
    (narrativeCapture?.payloadJson as { text?: string } | null)?.text?.trim() ?? null;

  type RegionEntry = {
    address?: string;
    sheetName?: string;
    regionType?: "input" | "output";
    reason?: string;
    values?: unknown[][];
  };
  const allRegions: RegionEntry[] =
    (regionCapture?.payloadJson as { regions?: RegionEntry[] } | null)?.regions ?? [];

  const inputRegions = allRegions.filter((r) => r.regionType === "input");
  const outputRegions = allRegions.filter(
    (r) => r.regionType === "output" || r.regionType === undefined,
  );

  function formatRegion(r: RegionEntry): string {
    // reason is the AI's description e.g. "Loss ratio assumption cells"
    const label = r.reason ?? `${r.sheetName ?? ""}!${r.address ?? ""}`.trim();
    const flat = (r.values ?? [])
      .flat()
      .filter((v) => v !== null && v !== "" && v !== undefined);
    const sample = flat.slice(0, 5).join(", ");
    return `${label}: ${sample || "(empty)"}`;
  }

  // 7. Build prompt
  const contextParts: string[] = [];
  if (workbookName) contextParts.push(`Excel file: "${workbookName}"`);
  else if (snapshotLabel) contextParts.push(`Snapshot: "${snapshotLabel}"`);
  if (parentLabel) contextParts.push(`Parent scenario: "${parentLabel}"`);
  if (narrativeText) contextParts.push(`Analyst note: "${narrativeText}"`);
  if (inputRegions.length > 0)
    contextParts.push(
      `Input assumptions:\n${inputRegions.slice(0, 5).map((r) => `  - ${formatRegion(r)}`).join("\n")}`,
    );
  if (outputRegions.length > 0)
    contextParts.push(
      `Output results:\n${outputRegions.slice(0, 5).map((r) => `  - ${formatRegion(r)}`).join("\n")}`,
    );

  const hasRegionData = inputRegions.length > 0 || outputRegions.length > 0;

  const prompt = [
    "You are labeling a saved scenario in a reinsurance analysis workbook.",
    "Generate a concise label (2–5 words, title case) that captures what makes this scenario distinct.",
    "Focus on the key assumption or output — e.g. 'Base Loss Ratio', 'IBNR +20% Stress', 'Cat Excess Layer'.",
    "Do NOT include quotes in the label.",
    "",
    ...(hasRegionData
      ? [
          "Also generate a brief summary (under 120 characters) describing what this workbook tool does — its analytical purpose based on what the input and output regions represent.",
          "Focus on the type of analysis, not the specific values. E.g. 'Takes paid loss triangles as input and produces ultimate loss ratio and IBNR estimates.'",
          "",
        ]
      : []),
    ...contextParts,
  ].join("\n");

  // 8. Call Claude
  let rawLabel = "Saved";
  let regionSummary: string | null = null;
  try {
    const result = await callClaudeTool<{ label: string; summary?: string }>({
      prompt,
      tool: {
        name: "set_label",
        description: "Set the scenario label and optional summary",
        input_schema: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "A 2–5 word title-case label for the saved scenario",
            },
            ...(hasRegionData && {
              summary: {
                type: "string",
                description:
                  "Brief description of what this workbook tool does analytically, based on what the input and output regions represent. Under 120 characters.",
              },
            }),
          },
          required: ["label"],
        },
      },
      maxTokens: 150,
    });
    rawLabel = result.label?.trim() || "Saved";
    regionSummary = result.summary?.trim() || null;
  } catch {
    rawLabel = narrativeText?.slice(0, 40) || "Saved";
  }

  // 9. Deduplicate against sibling labels
  let finalLabel = rawLabel;
  if (siblingLabels.has(finalLabel)) {
    let n = 2;
    while (siblingLabels.has(`${rawLabel} ${n}`)) n++;
    finalLabel = `${rawLabel} ${n}`;
  }

  // 10. Update parametersJson.label on the operation
  const existingParams = (op.parametersJson as Record<string, unknown>) ?? {};
  await db
    .update(runOperations)
    .set({ parametersJson: { ...existingParams, label: finalLabel } })
    .where(eq(runOperations.id, input.operationId));

  // 11. Write summary back to region_values capture summaryText
  if (regionSummary && regionCapture) {
    await db
      .update(runOperationCaptures)
      .set({ summaryText: regionSummary })
      .where(eq(runOperationCaptures.id, regionCapture.id));
  }

  return { label: finalLabel };
}
