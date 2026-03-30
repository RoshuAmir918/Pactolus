import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runBranches, runOperations } from "@db/schema";
import { assertBranchAccess } from "./assertBranchAccess";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type CreateBranchInput = {
  orgId: string;
  userId: string;
  runId: string;
  name: string;
  parentBranchId?: string;
  forkedFromStepId?: string;
};

export type CreateBranchResult = {
  branchId: string;
  runId: string;
  parentBranchId: string | null;
  forkedFromStepId: string | null;
  status: "active" | "archived";
};

export async function createBranch(input: CreateBranchInput): Promise<CreateBranchResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const parentBranchId = input.parentBranchId ?? (await resolveMainBranchId(input.runId));

  const parentBranch = await assertBranchAccess({
    branchId: parentBranchId,
    runId: input.runId,
  });

  if (input.forkedFromStepId) {
    const [forkStep] = await db
      .select({ id: runOperations.id })
      .from(runOperations)
      .where(
        and(
          eq(runOperations.id, input.forkedFromStepId),
          eq(runOperations.branchId, parentBranch.id),
        ),
      )
      .limit(1);

    if (!forkStep) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "forkedFromStepId must belong to the parent branch",
      });
    }
  }

  const [createdBranch] = await db
    .insert(runBranches)
    .values({
      runId: input.runId,
      parentBranchId: parentBranch.id,
      forkedFromStepId: input.forkedFromStepId ?? null,
      name: input.name,
      createdByUserId: input.userId,
      status: "active",
    })
    .returning();

  return {
    branchId: createdBranch.id,
    runId: createdBranch.runId,
    parentBranchId: createdBranch.parentBranchId,
    forkedFromStepId: createdBranch.forkedFromStepId,
    status: createdBranch.status,
  };
}

async function resolveMainBranchId(runId: string): Promise<string> {
  const [mainBranch] = await db
    .select({ id: runBranches.id })
    .from(runBranches)
    .where(
      and(eq(runBranches.runId, runId), eq(runBranches.name, "main"), isNull(runBranches.parentBranchId)),
    )
    .limit(1);

  if (!mainBranch) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Main branch not found for this run",
    });
  }

  return mainBranch.id;
}
