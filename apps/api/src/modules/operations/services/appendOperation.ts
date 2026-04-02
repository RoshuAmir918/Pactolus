import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runOperations, runs } from "@db/schema";
import { appendRunOperation } from "@db/schema/operations/runHistory";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type AppendOperationInput = {
  orgId: string;
  userId: string;
  runId: string;
  documentId?: string;
  operationType: typeof runOperations.$inferInsert.operationType;
  idempotencyKey?: string;
  parentOperationId?: string;
  supersedesOperationId?: string;
  parametersJson: unknown;
};

export type AppendOperationResult = {
  operationId: string;
  runId: string;
  operationIndex: number;
  operationType: typeof runOperations.$inferInsert.operationType;
  actorType: typeof runOperations.$inferInsert.actorType;
  actorId: string | null;
};

export async function appendOperation(input: AppendOperationInput): Promise<AppendOperationResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  if (input.parentOperationId) {
    await assertOperationBelongsToRun({ operationId: input.parentOperationId, runId: input.runId, label: "parentOperationId" });
  }

  if (input.supersedesOperationId) {
    await assertOperationBelongsToRun({ operationId: input.supersedesOperationId, runId: input.runId, label: "supersedesOperationId" });
  }

  const created = await appendRunOperation(db, {
    runId: input.runId,
    documentId: input.documentId,
    operationType: input.operationType,
    actorType: "user",
    actorId: input.userId,
    idempotencyKey: input.idempotencyKey,
    parametersJson: input.parametersJson,
    parentOperationId: input.parentOperationId,
    supersedesOperationId: input.supersedesOperationId,
  });

  await db
    .update(runs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(runs.id, input.runId));

  return {
    operationId: created.id,
    runId: created.runId,
    operationIndex: created.operationIndex,
    operationType: created.operationType,
    actorType: created.actorType,
    actorId: created.actorId,
  };
}

async function assertOperationBelongsToRun(input: {
  operationId: string;
  runId: string;
  label: string;
}): Promise<void> {
  const [op] = await db
    .select({ id: runOperations.id })
    .from(runOperations)
    .where(and(eq(runOperations.id, input.operationId), eq(runOperations.runId, input.runId)))
    .limit(1);

  if (!op) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${input.label} must belong to the run` });
  }
}
