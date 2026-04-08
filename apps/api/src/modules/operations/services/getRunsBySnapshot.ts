import { and, desc, eq, sql } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperations, runs, users } from "@db/schema";

const { db } = dbClient;

export type GetRunsBySnapshotInput = {
  orgId: string;
  snapshotId: string;
  limit?: number;
};

export async function getRunsBySnapshot(input: GetRunsBySnapshotInput) {
  const result = await db
    .select({
      id: runs.id,
      name: runs.name,
      status: runs.status,
      createdByName: users.fullName,
      nodeCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${runOperations} ro
        WHERE ro.run_id = ${runs.id}
          AND ro.operation_type = 'scenario_snapshot'
          AND NOT EXISTS (
            SELECT 1 FROM ${runOperations} ro2
            WHERE ro2.supersedes_operation_id = ro.id
              AND ro2.run_id = ${runs.id}
          )
      )`,
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

export type GetRunsBySnapshotResult = Awaited<ReturnType<typeof getRunsBySnapshot>>;
