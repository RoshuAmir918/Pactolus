import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { rawRows, snapshotInputs, snapshots } from "@db/schema";
import { parseCsv } from "./parseCsv";

const { db } = dbClient;

export type UploadEntityType = "claim" | "policy";

export type PersistCsvUploadInput = {
  orgId: string;
  snapshotId: string;
  fileName: string;
  csvText: string;
  entityType: UploadEntityType;
};

export type PersistCsvUploadResult = {
  snapshotInputId: string;
  entityType: UploadEntityType;
  detectedColumns: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function buildStableRowHash(row: Record<string, string>, columns: string[]): string {
  const normalized: Record<string, string> = {};
  columns.forEach((column) => {
    normalized[column] = row[column] ?? "";
  });
  return sha256(JSON.stringify(normalized));
}

export async function persistCsvUpload(
  input: PersistCsvUploadInput,
): Promise<PersistCsvUploadResult> {
  const parsed = parseCsv(input.csvText);
  if (parsed.detectedColumns.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CSV must include a header row",
    });
  }

  const [snapshot] = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.orgId, input.orgId)))
    .limit(1);

  if (!snapshot) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Snapshot not found for this organization",
    });
  }

  const fileHash = sha256(input.csvText);
  const now = new Date();

  const snapshotInputId = await db.transaction(async (tx) => {
    await tx
      .update(snapshots)
      .set({ status: "ingesting", updatedAt: now })
      .where(eq(snapshots.id, input.snapshotId));

    const [upserted] = await tx
      .insert(snapshotInputs)
      .values({
        snapshotId: input.snapshotId,
        entityType: input.entityType,
        fileName: input.fileName,
        fileHash,
        status: "ingesting",
        rowCount: parsed.rowCount,
      })
      .onConflictDoUpdate({
        target: [snapshotInputs.snapshotId, snapshotInputs.entityType],
        set: {
          fileName: input.fileName,
          fileHash,
          status: "ingesting",
          rowCount: parsed.rowCount,
          updatedAt: now,
        },
      })
      .returning({ id: snapshotInputs.id });

    await tx.delete(rawRows).where(eq(rawRows.snapshotInputId, upserted.id));

    if (parsed.rows.length > 0) {
      await tx.insert(rawRows).values(
        parsed.rows.map((row, idx) => ({
          snapshotId: input.snapshotId,
          snapshotInputId: upserted.id,
          rowNumber: idx + 1,
          rawJson: row,
          rawHash: buildStableRowHash(row, parsed.detectedColumns),
        })),
      );
    }

    await tx
      .update(snapshotInputs)
      .set({
        status: "ready",
        rowCount: parsed.rowCount,
        updatedAt: now,
      })
      .where(eq(snapshotInputs.id, upserted.id));

    await tx
      .update(snapshots)
      .set({ status: "ready", updatedAt: now })
      .where(eq(snapshots.id, input.snapshotId));

    return upserted.id;
  });

  return {
    snapshotInputId,
    entityType: input.entityType,
    detectedColumns: parsed.detectedColumns,
    rowCount: parsed.rowCount,
    sampleRows: parsed.sampleRows,
  };
}
