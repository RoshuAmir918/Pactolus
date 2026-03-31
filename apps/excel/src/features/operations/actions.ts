import type {
  BranchOption,
  LiveHintSuggestion,
  MonitoredRegion,
  RunOption,
  RunSession,
  Snapshot,
} from "@/features/types";

export function parseTargetColumns(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function pickBestSuggestion(
  hints: Array<{
    targetColumn: string;
    suggestions: LiveHintSuggestion[];
  }>,
): LiveHintSuggestion | null {
  let best: LiveHintSuggestion | null = null;
  for (const hint of hints) {
    for (const suggestion of hint.suggestions) {
      if (!best || suggestion.confidence > best.confidence) {
        best = suggestion;
      }
    }
  }
  return best;
}

export async function appendRunStepIfActive(input: {
  client: any;
  runSession: RunSession;
  stepType: string;
  idempotencyKey?: string;
  parentStepId?: string;
  parametersJson: unknown;
  documentId?: string;
  runId?: string;
  branchId?: string;
}): Promise<string | null> {
  const runId = input.runId ?? input.runSession.runId;
  const branchId = input.branchId ?? input.runSession.branchId;
  if (!runId || !branchId) {
    return null;
  }

  const step = await input.client.operations.appendStep.mutate({
    runId,
    branchId,
    stepType: input.stepType,
    idempotencyKey: input.idempotencyKey,
    parentStepId: input.parentStepId ?? input.runSession.lastStepId ?? undefined,
    parametersJson: input.parametersJson,
    documentId: input.documentId,
  });
  return step.stepId;
}

export function parseJsonOrText(value: string): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function parseConfidence(value: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error("Assumption confidence must be a number between 0 and 1.");
  }
  if (parsed < 0 || parsed > 1) {
    throw new Error("Assumption confidence must be between 0 and 1.");
  }
  return Math.round(parsed * 100) / 100;
}

export function toRunOptions(
  runs: Array<{ id: string; name: string; status: string; createdByName: string; createdAt: Date }>,
): RunOption[] {
  return runs.map((run) => ({
    id: run.id,
    name: run.name,
    status: run.status,
    createdByName: run.createdByName,
    createdAt: run.createdAt,
  }));
}

export function toBranchOptions(
  branches: Array<{ id: string; name: string; status: string }>,
): BranchOption[] {
  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    status: branch.status,
  }));
}

export function isSelectedBranchActive(
  runSession: RunSession,
  availableBranches: BranchOption[],
): boolean {
  const selectedBranchStatus =
    availableBranches.find((branch) => branch.id === runSession.branchId)?.status ?? null;
  return selectedBranchStatus !== "archived";
}

export function buildSheetSlice(snapshot: Snapshot) {
  return {
    workbookName: snapshot.workbookName,
    sheetName: snapshot.sheetName,
    selectedAddress: snapshot.selectedAddress,
    rowCount: snapshot.rowCount,
    columnCount: snapshot.columnCount,
    headers: snapshot.headers,
    sampleRows: snapshot.sampleRows,
  };
}

export function formatBranchesSummary(
  result: {
    branchStatus: string;
    assumptionDiff: {
      baselineCount: number;
      finalCount: number;
      added: unknown[];
      removed: unknown[];
      modified: unknown[];
    };
    aiSummary:
      | {
          summary: string;
          confidence: number | null;
          notableChanges: string[];
        }
      | null;
  },
): string {
  const aiSummaryText = result.aiSummary
    ? [
        `Summary: ${result.aiSummary.summary}`,
        `Confidence: ${result.aiSummary.confidence ?? "n/a"}`,
        "Notable changes:",
        ...result.aiSummary.notableChanges.map((item) => `- ${item}`),
      ].join("\n")
    : "AI summary unavailable.";

  return [
    `Branch status: ${result.branchStatus}`,
    `Assumptions baseline -> final: ${result.assumptionDiff.baselineCount} -> ${result.assumptionDiff.finalCount}`,
    `Added: ${result.assumptionDiff.added.length}`,
    `Removed: ${result.assumptionDiff.removed.length}`,
    `Modified: ${result.assumptionDiff.modified.length}`,
    "",
    aiSummaryText,
  ].join("\n");
}

export function emptyRunSession(): RunSession {
  return {
    runId: null,
    branchId: null,
    lastStepId: null,
    startedAtIso: null,
  };
}

export function emptyRegionsState(): {
  detectedRegions: MonitoredRegion[];
  monitoredRegions: MonitoredRegion[];
} {
  return {
    detectedRegions: [],
    monitoredRegions: [],
  };
}
