import { and, asc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { fileObjects } from "@db/schema";

const { db } = dbClient;

export type ListBySnapshotInput = {
  orgId: string;
  snapshotId: string;
};

export async function listBySnapshot(input: ListBySnapshotInput) {
  const rows = await db
    .select({
      id: fileObjects.id,
      fileName: fileObjects.fileName,
      contentType: fileObjects.contentType,
      sizeBytes: fileObjects.sizeBytes,
      createdAt: fileObjects.createdAt,
    })
    .from(fileObjects)
    .where(
      and(
        eq(fileObjects.orgId, input.orgId),
        eq(fileObjects.snapshotId, input.snapshotId),
        eq(fileObjects.status, "ready"),
      ),
    )
    .orderBy(asc(fileObjects.createdAt));

  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    contentType: r.contentType,
    sizeBytes: Number(r.sizeBytes),
    createdAt: r.createdAt,
  }));
}

export type ListBySnapshotResult = Awaited<ReturnType<typeof listBySnapshot>>;
export type ListBySnapshotItem = ListBySnapshotResult[number];
