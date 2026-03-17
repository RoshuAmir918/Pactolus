import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { snapshots } from "@db/schema";

const { db } = dbClient;

export async function assertSnapshotAccess(input: {
  snapshotId: string;
  orgId: string;
}): Promise<typeof snapshots.$inferSelect> {
  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.orgId, input.orgId)))
    .limit(1);

  if (!snapshot) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Snapshot not found for this organization",
    });
  }

  return snapshot;
}
