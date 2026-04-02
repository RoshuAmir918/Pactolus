import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runOperations } from "@db/schema";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GetOperationAncestorsInput = {
  orgId: string;
  runId: string;
  operationId: string;
};

export type GetOperationAncestorsResult = {
  operations: Array<typeof runOperations.$inferSelect>;
};

/**
 * Walks the parentOperationId chain from operationId up to the root,
 * returning the full ancestor chain in root-first order.
 */
export async function getOperationAncestors(
  input: GetOperationAncestorsInput,
): Promise<GetOperationAncestorsResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const chain: Array<typeof runOperations.$inferSelect> = [];
  const seen = new Set<string>();
  let currentId: string | null = input.operationId;

  while (currentId) {
    if (seen.has(currentId)) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cycle detected in operation ancestry" });
    }
    seen.add(currentId);

    const [op] = await db
      .select()
      .from(runOperations)
      .where(and(eq(runOperations.id, currentId), eq(runOperations.runId, input.runId)))
      .limit(1);

    if (!op) break;
    chain.unshift(op); // prepend → root-first order
    currentId = op.parentOperationId;
  }

  return { operations: chain };
}
