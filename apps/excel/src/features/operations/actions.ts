import type {
  LiveHintSuggestion,
  MonitoredRegion,
  OperationRecord,
  RunOption,
  RunSession,
  Snapshot,
} from "@/features/types";

export function parseTargetColumns(input: string): string[] {
  return input.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
}

export function pickBestSuggestion(
  hints: Array<{ targetColumn: string; suggestions: LiveHintSuggestion[] }>,
): LiveHintSuggestion | null {
  let best: LiveHintSuggestion | null = null;
  for (const hint of hints) {
    for (const s of hint.suggestions) {
      if (!best || s.confidence > best.confidence) best = s;
    }
  }
  return best;
}

export async function appendOperationIfActive(input: {
  client: any;
  runSession: RunSession;
  operationType: string;
  idempotencyKey?: string;
  parentOperationId?: string | null;
  supersedesOperationId?: string | null;
  parametersJson: unknown;
  documentId?: string;
}): Promise<string | null> {
  const runId = input.runSession.runId;
  if (!runId) return null;

  const op = await input.client.operations.appendOperation.mutate({
    runId,
    operationType: input.operationType,
    idempotencyKey: input.idempotencyKey,
    parentOperationId: input.parentOperationId ?? undefined,
    supersedesOperationId: input.supersedesOperationId ?? undefined,
    parametersJson: input.parametersJson,
    documentId: input.documentId,
  });
  return op.operationId;
}

export function toRunOptions(
  runs: Array<{ id: string; name: string; status: string; createdByName: string; createdAt: Date }>,
): RunOption[] {
  return runs.map((r) => ({ id: r.id, name: r.name, status: r.status, createdByName: r.createdByName, createdAt: r.createdAt }));
}

export function parseJsonOrText(value: string): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

export function parseConfidence(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error("Assumption confidence must be a number between 0 and 1.");
  if (parsed < 0 || parsed > 1) throw new Error("Assumption confidence must be between 0 and 1.");
  return Math.round(parsed * 100) / 100;
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

export function emptyRunSession(): RunSession {
  return { runId: null, currentOperationId: null, startedAtIso: null };
}

export function emptyRegionsState(): { detectedRegions: MonitoredRegion[]; monitoredRegions: MonitoredRegion[] } {
  return { detectedRegions: [], monitoredRegions: [] };
}

/** Find the last scenario_snapshot that is NOT superseded — the current tip visible in the tree */
export function findCurrentTip(operations: OperationRecord[], currentOperationId: string | null): OperationRecord | null {
  if (currentOperationId) {
    const op = operations.find(o => o.id === currentOperationId);
    if (op) return op;
  }
  const supersededIds = new Set(operations.map(o => o.supersedesOperationId).filter(Boolean));
  const snapshots = operations
    .filter(o => o.operationType === "scenario_snapshot" && !supersededIds.has(o.id))
    .sort((a, b) => a.operationIndex - b.operationIndex);
  return snapshots.at(-1) ?? null;
}
