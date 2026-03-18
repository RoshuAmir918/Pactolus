import { and, count, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { documentInsights, documentSheets, documents, documentTriangles, fileObjects } from "@db/schema";
import type {
  DocumentIngestionStatusResult,
  GetDocumentIngestionStatusInput,
  StartDocumentIngestionInput,
  TargetDocument,
} from "../shared/types";

const { db } = dbClient;

export async function getTargetDocument(input: StartDocumentIngestionInput): Promise<TargetDocument> {
  const [row] = await db
    .select({
      documentId: documents.id,
      orgId: documents.orgId,
      snapshotId: documents.snapshotId,
      filename: documents.filename,
      fileExtension: documents.fileExtension,
      fileSizeBytes: documents.fileSizeBytes,
      mimeType: documents.mimeType,
      bucket: fileObjects.bucket,
      objectKey: fileObjects.objectKey,
      deletedAt: fileObjects.deletedAt,
      fileStatus: fileObjects.status,
    })
    .from(documents)
    .innerJoin(fileObjects, eq(fileObjects.id, documents.fileObjectId))
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.orgId, input.orgId),
        eq(documents.snapshotId, input.snapshotId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Document not found",
    });
  }
  return row;
}

export function assertDocumentReady(fileStatus: string, deletedAt: Date | null) {
  if (fileStatus !== "ready") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Document file is not ready for ingestion",
    });
  }
  if (deletedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Document file has been deleted",
    });
  }
}

export async function setDocumentPending(documentId: string) {
  await db
    .update(documents)
    .set({
      profileStatus: "pending",
      aiStatus: "pending",
      errorText: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}

export async function setDocumentCompleted(documentId: string) {
  await db
    .update(documents)
    .set({
      profileStatus: "completed",
      aiStatus: "completed",
      errorText: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}

export async function setDocumentFailed(documentId: string, errorText: string) {
  await db
    .update(documents)
    .set({
      profileStatus: "failed",
      aiStatus: "failed",
      errorText,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}

export async function clearTrianglesAndInsights(documentId: string) {
  await db.delete(documentTriangles).where(eq(documentTriangles.documentId, documentId));
  await db.delete(documentInsights).where(eq(documentInsights.documentId, documentId));
}

export async function setDocumentClassificationFromRouting(input: {
  documentId: string;
  documentType: DocumentIngestionStatusResult["documentType"];
  aiClassification: DocumentIngestionStatusResult["aiClassification"];
  aiConfidence: string | null;
}) {
  await db
    .update(documents)
    .set({
      documentType: input.documentType,
      aiClassification: input.aiClassification,
      aiConfidence: input.aiConfidence,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, input.documentId));
}

export async function updateDocumentSearchText(documentId: string, searchText: string | null) {
  await db
    .update(documents)
    .set({
      searchText,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}

export async function getDocumentIngestionStatus(
  input: GetDocumentIngestionStatusInput,
): Promise<DocumentIngestionStatusResult> {
  const [document] = await db
    .select({
      id: documents.id,
      profileStatus: documents.profileStatus,
      aiStatus: documents.aiStatus,
      documentType: documents.documentType,
      aiClassification: documents.aiClassification,
      errorText: documents.errorText,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.orgId, input.orgId),
        eq(documents.snapshotId, input.snapshotId),
      ),
    )
    .limit(1);

  if (!document) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Document not found",
    });
  }

  const [sheetCounts] = await db
    .select({ count: count() })
    .from(documentSheets)
    .where(eq(documentSheets.documentId, input.documentId));
  const [triangleCounts] = await db
    .select({ count: count() })
    .from(documentTriangles)
    .where(eq(documentTriangles.documentId, input.documentId));
  const [insightCounts] = await db
    .select({ count: count() })
    .from(documentInsights)
    .where(eq(documentInsights.documentId, input.documentId));

  return {
    documentId: document.id,
    profileStatus: document.profileStatus,
    aiStatus: document.aiStatus,
    documentType: document.documentType,
    aiClassification: document.aiClassification,
    sheetCount: Number(sheetCounts?.count ?? 0),
    triangleCount: Number(triangleCounts?.count ?? 0),
    insightCount: Number(insightCounts?.count ?? 0),
    errorText: document.errorText,
  };
}
