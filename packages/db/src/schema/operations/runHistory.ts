import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { runOperationCaptures, runOperations } from "../index";

type DbLike = NodePgDatabase<Record<string, never>>;

type AppendRunOperationInput = {
  runId: string;
  documentId?: string | null;
  operationType: typeof runOperations.$inferInsert.operationType;
  actorType: typeof runOperations.$inferInsert.actorType;
  actorId?: string | null;
  idempotencyKey?: string | null;
  parametersJson: unknown;
  parentOperationId?: string | null;
  supersedesOperationId?: string | null;
};

export async function appendRunOperation(
  db: DbLike,
  input: AppendRunOperationInput,
): Promise<typeof runOperations.$inferSelect> {
  return db.transaction(async (tx) => {
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select()
        .from(runOperations)
        .where(
          and(
            eq(runOperations.runId, input.runId),
            eq(runOperations.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (existing) return existing;
    }

    const [next] = await tx
      .select({
        operationIndex: sql<number>`coalesce(max(${runOperations.operationIndex}), 0) + 1`,
      })
      .from(runOperations)
      .where(eq(runOperations.runId, input.runId));

    const [created] = await tx
      .insert(runOperations)
      .values({
        runId: input.runId,
        documentId: input.documentId ?? null,
        operationIndex: next?.operationIndex ?? 1,
        operationType: input.operationType,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        parametersJson: input.parametersJson,
        parentOperationId: input.parentOperationId ?? null,
        supersedesOperationId: input.supersedesOperationId ?? null,
      })
      .returning();

    return created;
  });
}

type InsertRunOperationCaptureInput = {
  runOperationId: string;
  captureType: string;
  payloadJson: unknown;
  summaryText?: string | null;
};

export async function insertRunOperationCapture(
  db: DbLike,
  input: InsertRunOperationCaptureInput,
): Promise<typeof runOperationCaptures.$inferSelect> {
  const [created] = await db
    .insert(runOperationCaptures)
    .values({
      runOperationId: input.runOperationId,
      captureType: input.captureType,
      payloadJson: input.payloadJson,
      summaryText: input.summaryText ?? null,
    })
    .returning();

  return created;
}

