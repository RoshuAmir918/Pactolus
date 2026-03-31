import { and, desc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runs, users } from "@db/schema";

const { db } = dbClient;

export type GetRunsBySnapshotInput = {
  orgId: string;
  snapshotId: string;
  limit?: number;
};

export type GetRunsBySnapshotResult = {
  runs: Array<{
    id: string;
    name: string;
    status: "draft" | "running" | "awaiting_confirmation" | "ready" | "failed" | "locked";
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export async function getRunsBySnapshot(
  input: GetRunsBySnapshotInput,
): Promise<GetRunsBySnapshotResult> {
  const result = await db
    .select({
      id: runs.id,
      name: runs.name,
      status: runs.status,
      createdByName: users.fullName,
      createdAt: runs.createdAt,
      updatedAt: runs.updatedAt,
    })
    .from(runs)
    .innerJoin(users, eq(runs.createdByUserId, users.id))
    .where(and(eq(runs.orgId, input.orgId), eq(runs.snapshotId, input.snapshotId)))
    .orderBy(desc(runs.createdAt))
    .limit(input.limit ?? 25);

  return { runs: result };
}
