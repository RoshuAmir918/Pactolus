import { and, asc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { fileObjects } from "@db/schema";

const { db } = dbClient;

export type ListBySnapshotInput = {
  orgId: string;
  snapshotId: string;
};

export type ListBySnapshotItem = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type ListBySnapshotResult = ListBySnapshotItem[];

export async function listBySnapshot(
  input: ListBySnapshotInput,
): Promise<ListBySnapshotResult> {
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
