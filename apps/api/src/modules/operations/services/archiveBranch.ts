import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runBranches } from "@db/schema";
import { assertBranchAccess } from "./assertBranchAccess";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type ArchiveBranchInput = {
  orgId: string;
  runId: string;
  branchId: string;
};

export type ArchiveBranchResult = {
  branchId: string;
  runId: string;
  status: "active" | "archived";
};

export async function archiveBranch(input: ArchiveBranchInput): Promise<ArchiveBranchResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });
  const branch = await assertBranchAccess({
    branchId: input.branchId,
    runId: input.runId,
  });

  if (branch.name === "main" && branch.parentBranchId === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot delete main branch",
    });
  }

  if (branch.status === "archived") {
    return {
      branchId: branch.id,
      runId: branch.runId,
      status: branch.status,
    };
  }

  const [updated] = await db
    .update(runBranches)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(runBranches.id, input.branchId),
        eq(runBranches.runId, input.runId),
      ),
    )
    .returning({
      branchId: runBranches.id,
      runId: runBranches.runId,
      status: runBranches.status,
    });

  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to archive branch",
    });
  }

  return updated;
}
