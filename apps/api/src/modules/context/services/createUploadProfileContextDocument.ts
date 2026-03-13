import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { contextDocumentSources, contextDocuments, snapshots } from "@db/schema";

const { db } = dbClient;

type CreateUploadProfileContextDocumentInput = {
  orgId: string;
  userId: string;
  snapshotId: string;
  runId: string;
  branchId: string;
  uploadStepId: string;
  snapshotInputId: string;
  entityType: "claim" | "policy";
  fileName: string;
  rowCount: number;
  detectedColumns: string[];
  sampleRows: Record<string, string>[];
};

export async function createUploadProfileContextDocument(
  input: CreateUploadProfileContextDocumentInput,
): Promise<{ contextDocumentId: string }> {
  const [snapshot] = await db
    .select({ id: snapshots.id, clientId: snapshots.clientId })
    .from(snapshots)
    .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.orgId, input.orgId)))
    .limit(1);

  if (!snapshot) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Snapshot not found for this organization",
    });
  }

  const [contextDocument] = await db
    .insert(contextDocuments)
    .values({
      orgId: input.orgId,
      clientId: snapshot.clientId,
      snapshotId: input.snapshotId,
      runId: input.runId,
      branchId: input.branchId,
      sourceStepId: input.uploadStepId,
      scopeType: "snapshot",
      docType: "raw_profile",
      truthTier: "tier0",
      title: `${input.entityType} upload profile`,
      summaryText: `${input.fileName} (${input.rowCount} rows, ${input.detectedColumns.length} columns)`,
      searchableText: [
        input.entityType,
        input.fileName,
        ...input.detectedColumns,
      ].join(" "),
      contentJson: {
        fileName: input.fileName,
        entityType: input.entityType,
        rowCount: input.rowCount,
        detectedColumns: input.detectedColumns,
        sampleRows: input.sampleRows,
      },
      keywordsJson: input.detectedColumns,
      provenanceJson: {
        source: "ingestion.uploadCsvToSnapshot",
        uploadStepId: input.uploadStepId,
        snapshotInputId: input.snapshotInputId,
      },
      createdByUserId: input.userId,
    })
    .returning({ id: contextDocuments.id });

  await db.insert(contextDocumentSources).values([
    {
      contextDocumentId: contextDocument.id,
      sourceType: "snapshot_input",
      sourceRefId: input.snapshotInputId,
    },
    {
      contextDocumentId: contextDocument.id,
      sourceType: "run_step",
      sourceRefId: input.uploadStepId,
    },
  ]);

  return { contextDocumentId: contextDocument.id };
}
