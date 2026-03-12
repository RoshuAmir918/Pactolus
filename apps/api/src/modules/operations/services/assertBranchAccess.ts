import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runBranches } from "@db/schema";

const { db } = dbClient;

export async function assertBranchAccess(input: {
  branchId: string;
  runId: string;
}): Promise<typeof runBranches.$inferSelect> {
  const [branch] = await db
    .select()
    .from(runBranches)
    .where(and(eq(runBranches.id, input.branchId), eq(runBranches.runId, input.runId)))
    .limit(1);

  if (!branch) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Branch not found for this run",
    });
  }

  return branch;
}
