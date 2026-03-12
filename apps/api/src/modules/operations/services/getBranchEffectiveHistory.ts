import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runBranches, runOperations } from "@db/schema";
import { assertBranchAccess } from "./assertBranchAccess";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GetBranchEffectiveHistoryInput = {
  orgId: string;
  runId: string;
  branchId: string;
};

export type GetBranchEffectiveHistoryResult = {
  lineageBranchIds: string[];
  steps: Array<typeof runOperations.$inferSelect>;
};

export async function getBranchEffectiveHistory(
  input: GetBranchEffectiveHistoryInput,
): Promise<GetBranchEffectiveHistoryResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });
  await assertBranchAccess({ runId: input.runId, branchId: input.branchId });

  const branches = await db
    .select()
    .from(runBranches)
    .where(eq(runBranches.runId, input.runId))
    .orderBy(asc(runBranches.createdAt));

  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const lineage = resolveLineage(input.branchId, branchById);
  const lineageBranchIds = lineage.map((branch) => branch.id);

  const stepsByBranchId = new Map<string, Array<typeof runOperations.$inferSelect>>();
  for (const branch of lineage) {
    const branchSteps = await db
      .select()
      .from(runOperations)
      .where(eq(runOperations.branchId, branch.id))
      .orderBy(asc(runOperations.stepIndex));
    stepsByBranchId.set(branch.id, branchSteps);
  }

  const effectiveSteps: Array<typeof runOperations.$inferSelect> = [];
  for (let index = 0; index < lineage.length; index += 1) {
    const current = lineage[index];
    const next = lineage[index + 1];
    const currentSteps = stepsByBranchId.get(current.id) ?? [];

    if (!next?.forkedFromStepId) {
      effectiveSteps.push(...currentSteps);
      continue;
    }

    const cutoffIndex = currentSteps.findIndex((step) => step.id === next.forkedFromStepId);
    if (cutoffIndex === -1) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Branch fork metadata is inconsistent with parent branch steps",
      });
    }

    effectiveSteps.push(...currentSteps.slice(0, cutoffIndex + 1));
  }

  return {
    lineageBranchIds,
    steps: effectiveSteps,
  };
}

function resolveLineage(
  branchId: string,
  branchById: Map<string, typeof runBranches.$inferSelect>,
): Array<typeof runBranches.$inferSelect> {
  const lineage: Array<typeof runBranches.$inferSelect> = [];
  const seen = new Set<string>();

  let cursorBranchId: string | null = branchId;
  while (cursorBranchId) {
    if (seen.has(cursorBranchId)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Cycle detected in branch lineage",
      });
    }
    seen.add(cursorBranchId);

    const branch = branchById.get(cursorBranchId);
    if (!branch) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Branch lineage is missing data",
      });
    }

    lineage.push(branch);
    cursorBranchId = branch.parentBranchId;
  }

  return lineage.reverse();
}
