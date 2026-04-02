import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { snapshots, runs } from "@db/schema";

const { db } = dbClient;

export type CreateRunInput = {
  orgId: string;
  userId: string;
  snapshotId: string;
  name?: string;
};

export type CreateRunResult = {
  runId: string;
  status: "draft" | "running" | "awaiting_confirmation" | "ready" | "failed" | "locked";
};

export async function createRun(input: CreateRunInput): Promise<CreateRunResult> {
  const [snapshot] = await db
    .select({ id: snapshots.id, label: snapshots.label })
    .from(snapshots)
    .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.orgId, input.orgId)))
    .limit(1);

  if (!snapshot) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Snapshot not found for this organization",
    });
  }

  const [createdRun] = await db
    .insert(runs)
    .values({
      orgId: input.orgId,
      snapshotId: input.snapshotId,
      name: input.name ?? `${snapshot.label} Run`,
      status: "running",
      createdByUserId: input.userId,
    })
    .returning({
      runId: runs.id,
      status: runs.status,
    });

  return {
    runId: createdRun.runId,
    status: createdRun.status,
  };
}
