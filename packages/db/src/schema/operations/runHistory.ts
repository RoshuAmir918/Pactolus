import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { runBranches, runOperationArtifacts, runOperations, runs, snapshots } from "../index";

type DbLike = NodePgDatabase<Record<string, never>>;

type AppendRunStepInput = {
  runId: string;
  branchId?: string;
  snapshotInputId?: string;
  stepType: typeof runOperations.$inferInsert.stepType;
  actorType: typeof runOperations.$inferInsert.actorType;
  actorId?: string | null;
  idempotencyKey?: string | null;
  parametersJson: unknown;
  parentStepId?: string | null;
  supersedesStepId?: string | null;
};

export async function appendRunStep(
  db: DbLike,
  input: AppendRunStepInput,
): Promise<typeof runOperations.$inferSelect> {
  return db.transaction(async (tx) => {
    let branchId = input.branchId;
    if (!branchId) {
      const [existingMainBranch] = await tx
        .select({ id: runBranches.id })
        .from(runBranches)
        .where(
          and(
            eq(runBranches.runId, input.runId),
            eq(runBranches.name, "main"),
            eq(runBranches.parentBranchId, null),
          ),
        )
        .orderBy(desc(runBranches.createdAt))
        .limit(1);

      if (existingMainBranch) {
        branchId = existingMainBranch.id;
      } else {
        const [run] = await tx
          .select({ createdByUserId: runs.createdByUserId })
          .from(runs)
          .where(eq(runs.id, input.runId))
          .limit(1);

        if (!run?.createdByUserId) {
          throw new Error("Run not found while resolving default main branch.");
        }

        const [createdMainBranch] = await tx
          .insert(runBranches)
          .values({
            runId: input.runId,
            name: "main",
            createdByUserId: run.createdByUserId,
          })
          .returning({ id: runBranches.id });

        branchId = createdMainBranch.id;
      }
    }

    if (input.idempotencyKey) {
      const [existing] = await tx
        .select()
        .from(runOperations)
        .where(
          and(
            eq(runOperations.branchId, branchId),
            eq(runOperations.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (existing) {
        return existing;
      }
    }

    const [nextStep] = await tx
      .select({
        stepIndex: sql<number>`coalesce(max(${runOperations.stepIndex}), 0) + 1`,
      })
      .from(runOperations)
      .where(eq(runOperations.branchId, branchId));

    const [created] = await tx
      .insert(runOperations)
      .values({
        runId: input.runId,
        branchId,
        snapshotInputId: input.snapshotInputId,
        stepIndex: nextStep?.stepIndex ?? 1,
        stepType: input.stepType,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        parametersJson: input.parametersJson,
        parentStepId: input.parentStepId ?? null,
        supersedesStepId: input.supersedesStepId ?? null,
      })
      .returning();

    return created;
  });
}

type InsertRunStepArtifactInput = {
  runStepId: string;
  artifactType: typeof runOperationArtifacts.$inferInsert.artifactType;
  dataJson: unknown;
};

export async function insertRunStepArtifact(
  db: DbLike,
  input: InsertRunStepArtifactInput,
): Promise<typeof runOperationArtifacts.$inferSelect> {
  const [created] = await db
    .insert(runOperationArtifacts)
    .values({
      runStepId: input.runStepId,
      artifactType: input.artifactType,
      dataJson: input.dataJson,
    })
    .onConflictDoUpdate({
      target: [runOperationArtifacts.runStepId, runOperationArtifacts.artifactType],
      set: {
        dataJson: input.dataJson,
      },
    })
    .returning();

  return created;
}

type EnsureRunForSnapshotInput = {
  orgId: string;
  snapshotId: string;
  createdByUserId: string;
};

export async function ensureRunForSnapshot(
  db: DbLike,
  input: EnsureRunForSnapshotInput,
): Promise<typeof runs.$inferSelect> {
  const [existing] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.orgId, input.orgId), eq(runs.snapshotId, input.snapshotId)))
    .orderBy(desc(runs.createdAt))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [snapshot] = await db
    .select({ label: snapshots.label })
    .from(snapshots)
    .where(eq(snapshots.id, input.snapshotId))
    .limit(1);

  const [created] = await db
    .insert(runs)
    .values({
      orgId: input.orgId,
      snapshotId: input.snapshotId,
      name: snapshot?.label ? `${snapshot.label} Run` : "Initial Run",
      status: "running",
      createdByUserId: input.createdByUserId,
    })
    .returning();

  return created;
}

type EnsureMainBranchForRunInput = {
  runId: string;
  createdByUserId: string;
};

export async function ensureMainBranchForRun(
  db: DbLike,
  input: EnsureMainBranchForRunInput,
): Promise<typeof runBranches.$inferSelect> {
  const [existing] = await db
    .select()
    .from(runBranches)
    .where(
      and(
        eq(runBranches.runId, input.runId),
        eq(runBranches.name, "main"),
        eq(runBranches.parentBranchId, null),
      ),
    )
    .orderBy(desc(runBranches.createdAt))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(runBranches)
    .values({
      runId: input.runId,
      name: "main",
      createdByUserId: input.createdByUserId,
    })
    .returning();

  return created;
}
