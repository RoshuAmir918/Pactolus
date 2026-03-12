import { asc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runBranches } from "@db/schema";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GetRunBranchesInput = {
  orgId: string;
  runId: string;
};

export type GetRunBranchesResult = {
  branches: Array<typeof runBranches.$inferSelect>;
};

export async function getRunBranches(input: GetRunBranchesInput): Promise<GetRunBranchesResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const branches = await db
    .select()
    .from(runBranches)
    .where(eq(runBranches.runId, input.runId))
    .orderBy(asc(runBranches.createdAt));

  return { branches };
}
