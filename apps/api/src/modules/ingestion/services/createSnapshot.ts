import dbClient from "@api/db/client";
import { snapshots } from "@db/schema";

const { db } = dbClient;

export type CreateSnapshotInput = {
  orgId: string;
  userId: string;
  label: string;
  accountingPeriod?: string;
};

export type CreateSnapshotResult = {
  snapshotId: string;
  status: "draft" | "ingesting" | "ready" | "failed";
};

export async function createSnapshot(
  input: CreateSnapshotInput,
): Promise<CreateSnapshotResult> {
  const [created] = await db
    .insert(snapshots)
    .values({
      orgId: input.orgId,
      createdByUserId: input.userId,
      label: input.label,
      accountingPeriod: input.accountingPeriod,
      status: "draft",
    })
    .returning({ snapshotId: snapshots.id, status: snapshots.status });

  return created;
}
