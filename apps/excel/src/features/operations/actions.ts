import type {
  RunOption,
  RunSession,
} from "@/features/types";

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

export function emptyRunSession(): RunSession {
  return { runId: null, currentOperationId: null, startedAtIso: null };
}
