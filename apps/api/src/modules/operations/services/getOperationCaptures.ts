import { eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperationCaptures, runOperations } from "@db/schema";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GetOperationCapturesInput = {
  orgId: string;
  runId: string;
  operationId: string;
};

export type GetOperationCapturesResult = {
  captures: Array<{
    id: string;
    captureType: string;
    payloadJson: unknown;
    summaryText: string | null;
    createdAt: Date;
  }>;
};

export async function getOperationCaptures(
  input: GetOperationCapturesInput,
): Promise<GetOperationCapturesResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const [op] = await db
    .select({ id: runOperations.id })
    .from(runOperations)
    .where(eq(runOperations.id, input.operationId))
    .limit(1);

  if (!op) return { captures: [] };

  const rows = await db
    .select()
    .from(runOperationCaptures)
    .where(eq(runOperationCaptures.runOperationId, input.operationId));

  return {
    captures: rows.map((r) => ({
      id: r.id,
      captureType: r.captureType,
      payloadJson: r.payloadJson,
      summaryText: r.summaryText,
      createdAt: r.createdAt,
    })),
  };
}
