import { and, eq, isNull } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperations } from "@db/schema";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GetRunBranchesInput = {
  orgId: string;
  runId: string;
};

export type GetRunBranchesResult = {
  branches: Array<typeof runOperations.$inferSelect>;
};

/**
 * Returns top-level scenario_snapshot operations for a run (no parentOperationId).
 * Each represents a distinct branch root.
 */
export async function getRunBranches(
  input: GetRunBranchesInput,
): Promise<GetRunBranchesResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  // Fetch all scenario_snapshot operations to compute superseded set
  const all = await db
    .select()
    .from(runOperations)
    .where(
      and(
        eq(runOperations.runId, input.runId),
        eq(runOperations.operationType, "scenario_snapshot"),
        isNull(runOperations.parentOperationId),
      ),
    );

  const supersededIds = new Set(
    all.map((o) => o.supersedesOperationId).filter(Boolean) as string[],
  );

  const branches = all.filter((o) => !supersededIds.has(o.id));

  return { branches };
}
