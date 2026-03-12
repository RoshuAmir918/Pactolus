import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runOperations, runs } from "@db/schema";
import { appendRunStep } from "@db/schema/operations/runHistory";
import { assertBranchAccess } from "./assertBranchAccess";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type AppendStepInput = {
  orgId: string;
  userId: string;
  runId: string;
  branchId?: string;
  snapshotInputId?: string;
  stepType: typeof runOperations.$inferInsert.stepType;
  idempotencyKey?: string;
  parentStepId?: string;
  supersedesStepId?: string;
  parametersJson: unknown;
};

export type AppendStepResult = {
  stepId: string;
  runId: string;
  branchId: string;
  stepIndex: number;
  stepType: typeof runOperations.$inferInsert.stepType;
  actorType: typeof runOperations.$inferInsert.actorType;
  actorId: string | null;
};

export async function appendStep(input: AppendStepInput): Promise<AppendStepResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  if (input.branchId) {
    await assertBranchAccess({
      branchId: input.branchId,
      runId: input.runId,
    });
  }

  if (input.parentStepId) {
    await assertStepBelongsToRun({
      stepId: input.parentStepId,
      runId: input.runId,
      label: "parentStepId",
    });
  }

  if (input.supersedesStepId) {
    await assertStepBelongsToRun({
      stepId: input.supersedesStepId,
      runId: input.runId,
      label: "supersedesStepId",
    });
  }

  const createdStep = await appendRunStep(db, {
    runId: input.runId,
    branchId: input.branchId,
    snapshotInputId: input.snapshotInputId,
    stepType: input.stepType,
    actorType: "user",
    actorId: input.userId,
    idempotencyKey: input.idempotencyKey,
    parametersJson: input.parametersJson,
    parentStepId: input.parentStepId,
    supersedesStepId: input.supersedesStepId,
  });

  await db
    .update(runs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(runs.id, input.runId));

  return {
    stepId: createdStep.id,
    runId: createdStep.runId,
    branchId: createdStep.branchId,
    stepIndex: createdStep.stepIndex,
    stepType: createdStep.stepType,
    actorType: createdStep.actorType,
    actorId: createdStep.actorId,
  };
}

async function assertStepBelongsToRun(input: {
  stepId: string;
  runId: string;
  label: "parentStepId" | "supersedesStepId";
}): Promise<void> {
  const [step] = await db
    .select({ id: runOperations.id })
    .from(runOperations)
    .where(and(eq(runOperations.id, input.stepId), eq(runOperations.runId, input.runId)))
    .limit(1);

  if (!step) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${input.label} must belong to the run`,
    });
  }
}
