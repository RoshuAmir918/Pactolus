import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { createUploadProfileContextDocument } from "@api/modules/context/services/createUploadProfileContextDocument";
import { ensureMainBranchForRun, ensureRunForSnapshot } from "@db/schema/operations/runHistory";
import { rawRows, runs, snapshotInputs, snapshots } from "@db/schema";
import { createCsvRowIterator, type CsvRow } from "./parseCsv";

const { db } = dbClient;
const RAW_ROW_INSERT_CHUNK_SIZE = 1000;

export type UploadEntityType = "claim" | "policy";

export type UploadCsvInput = {
  orgId: string;
  snapshotId: string;
  fileName: string;
  csvText: string;
  entityType: UploadEntityType;
};

export type UploadCsvResult = {
  snapshotInputId: string;
  entityType: UploadEntityType;
  detectedColumns: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
};

export type UploadCsvToSnapshotInput = UploadCsvInput & {
  userId: string;
};

export type UploadCsvToSnapshotResult = UploadCsvResult & {
  runId: string;
};

export type BatchUploadFileInput = {
  fileName: string;
  csvText: string;
  entityType?: UploadEntityType;
};

export type UploadCsvFilesInput = {
  orgId: string;
  userId: string;
  snapshotId: string;
  files: BatchUploadFileInput[];
};

export type UploadCsvFilesResult = {
  uploads: UploadCsvToSnapshotResult[];
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

async function assertSnapshotExists(input: {
  orgId: string;
  snapshotId: string;
}): Promise<void> {
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
}

type ClassifyEntityTypeForFileInput = {
  fileName: string;
  csvText: string;
};

/*
Future AI classification hook:

When we are ready to auto-classify uploaded files, this is the decision point
to replace the current caller-supplied `entityType` requirement.

Expected shape:
- inspect file metadata such as `fileName`
- optionally parse a small CSV sample / header row
- call an AI model to classify the file as `"claim"` or `"policy"`
- return the inferred entity type to `resolveEntityTypeForFile()`

For now, batch upload still requires the client to send `entityType`.
*/
async function classifyEntityTypeForFileWithAi(
  _input: ClassifyEntityTypeForFileInput,
): Promise<UploadEntityType> {
  throw new Error("AI-based entity type classification is not implemented yet");
}

export function resolveEntityTypeForFile(file: BatchUploadFileInput): UploadEntityType {
  if (!file.entityType) {
    // Future path:
    // return await classifyEntityTypeForFileWithAi({
    //   fileName: file.fileName,
    //   csvText: file.csvText,
    // });
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "entityType is currently required until AI classification is enabled",
    });
  }

  return file.entityType;
}

export async function uploadCsv(input: UploadCsvInput): Promise<UploadCsvResult> {
  const parsed = createCsvRowIterator(input.csvText);
  if (parsed.detectedColumns.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CSV must include a header row",
    });
  }

  await assertSnapshotExists({
    orgId: input.orgId,
    snapshotId: input.snapshotId,
  });

  const fileHash = sha256(input.csvText);
  const now = new Date();
  const sampleRows: CsvRow[] = [];
  let rowCount = 0;

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
        rowCount: 0,
      })
      .onConflictDoUpdate({
        target: [snapshotInputs.snapshotId, snapshotInputs.entityType],
        set: {
          fileName: input.fileName,
          fileHash,
          status: "ingesting",
          rowCount: 0,
          updatedAt: now,
        },
      })
      .returning({ id: snapshotInputs.id });

    await tx.delete(rawRows).where(eq(rawRows.snapshotInputId, upserted.id));

    let rawRowBatch: Array<{
      snapshotId: string;
      snapshotInputId: string;
      rowNumber: number;
      rawJson: CsvRow;
      rawHash: string;
    }> = [];
    for (const row of parsed.rows) {
      rowCount += 1;
      if (sampleRows.length < 5) {
        sampleRows.push(row);
      }

      rawRowBatch.push({
        snapshotId: input.snapshotId,
        snapshotInputId: upserted.id,
        rowNumber: rowCount,
        rawJson: row,
        rawHash: buildStableRowHash(row, parsed.detectedColumns),
      });

      if (rawRowBatch.length === RAW_ROW_INSERT_CHUNK_SIZE) {
        await tx.insert(rawRows).values(rawRowBatch);
        rawRowBatch = [];
      }
    }

    if (rawRowBatch.length > 0) {
      await tx.insert(rawRows).values(rawRowBatch);
    }

    await tx
      .update(snapshotInputs)
      .set({
        status: "ready",
        rowCount,
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
    rowCount,
    sampleRows,
  };
}

export async function uploadCsvToSnapshot(
  input: UploadCsvToSnapshotInput,
): Promise<UploadCsvToSnapshotResult> {
  const run = await ensureRunForSnapshot(db, {
    orgId: input.orgId,
    snapshotId: input.snapshotId,
    createdByUserId: input.userId,
  });

  const uploaded = await uploadCsv({
    orgId: input.orgId,
    snapshotId: input.snapshotId,
    fileName: input.fileName,
    csvText: input.csvText,
    entityType: input.entityType,
  });

  await db
    .update(runs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(runs.id, run.id));

  const mainBranch = await ensureMainBranchForRun(db, {
    runId: run.id,
    createdByUserId: input.userId,
  });

  await createUploadProfileContextDocument({
    orgId: input.orgId,
    userId: input.userId,
    snapshotId: input.snapshotId,
    runId: run.id,
    branchId: mainBranch.id,
    snapshotInputId: uploaded.snapshotInputId,
    entityType: input.entityType,
    fileName: input.fileName,
    rowCount: uploaded.rowCount,
    detectedColumns: uploaded.detectedColumns,
    sampleRows: uploaded.sampleRows,
  });

  // Mapping suggestion will be triggered by a separate procedure later.
  // const proposal = await executeProposeMappingWorkflow({ ... });

  return {
    ...uploaded,
    runId: run.id,
  };
}

export async function uploadCsvFiles(
  input: UploadCsvFilesInput,
): Promise<UploadCsvFilesResult> {
  await assertSnapshotExists({
    orgId: input.orgId,
    snapshotId: input.snapshotId,
  });

  const uploads: UploadCsvToSnapshotResult[] = [];
  for (const file of input.files) {
    const entityType = resolveEntityTypeForFile(file);
    const upload = await uploadCsvToSnapshot({
      orgId: input.orgId,
      userId: input.userId,
      snapshotId: input.snapshotId,
      fileName: file.fileName,
      csvText: file.csvText,
      entityType,
    });
    uploads.push(upload);
  }

  return { uploads };
}
